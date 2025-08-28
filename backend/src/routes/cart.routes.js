const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate, requireRole } = require('../middleware/auth');
const Coupon = require('../models/Coupon');

const router = express.Router();

// Get user's cart
router.get('/me', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    
    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = new Cart({ user: req.user.id, items: [] });
      await cart.save();
    }

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ success: false, message: 'Failed to get cart' });
  }
});

// Add item to cart
router.post('/me/items', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { product, quantity = 1, selectedAttributes } = req.body;

    if (!product || !quantity) {
      return res.status(400).json({ success: false, message: 'Product and quantity are required' });
    }

    // Resolve product id from body (supports string id or object with id/_id)
    const bodyProductId = (typeof product === 'string' || typeof product === 'number')
      ? String(product)
      : (product?.id || product?._id);

    // Verify product exists
    const productDoc = await Product.findById(bodyProductId);
    if (!productDoc) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Normalize selectedAttributes: only keep keys with non-empty values
    const normalizedSelected = Object.keys(selectedAttributes || {}).reduce((acc, key) => {
      const value = selectedAttributes[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {});

    console.log('Cart:add: productId =', bodyProductId, 'quantity =', quantity, 'selected =', normalizedSelected);

    // Build product payload for cart (ensure base fields present)
    const baseProduct = {
      id: productDoc._id.toString(),
      _id: productDoc._id.toString(),
      regularPrice: productDoc.regularPrice,
      specialPrice: productDoc.specialPrice,
      stock: productDoc.stock,
      sku: productDoc.sku,
      images: Array.isArray(productDoc.images) ? productDoc.images : [],
    };

    // If variant attributes were provided, derive variant on server side
    let productForCart = { ...baseProduct };
    if (Object.keys(normalizedSelected).length > 0 && Array.isArray(productDoc.variants)) {
      const foundVariant = productDoc.variants.find(v => {
        let attrs = {};
        if (v.attributes) {
          if (typeof v.attributes.toJSON === 'function') {
            attrs = v.attributes.toJSON();
          } else if (typeof v.attributes.get === 'function') {
            try { attrs = Object.fromEntries(v.attributes); } catch (_) { attrs = {}; }
          } else {
            attrs = v.attributes || {};
          }
        }
        return Object.keys(normalizedSelected).every(k => String(attrs[k]) === String(normalizedSelected[k]));
      });

      if (foundVariant) {
        console.log('Cart:add: matched variant for selected attrs');
        productForCart.selectedVariant = {
          attributes: normalizedSelected,
          price: foundVariant.price ?? productDoc.regularPrice,
          specialPrice: foundVariant.specialPrice ?? productDoc.specialPrice,
          stock: foundVariant.stock ?? productDoc.stock,
          sku: foundVariant.sku ?? productDoc.sku,
          images: Array.isArray(foundVariant.images) ? foundVariant.images : [],
        };
        // Prefer variant stock/images at top-level for client previews
        productForCart.stock = productForCart.selectedVariant.stock;
        if (productForCart.selectedVariant.images.length > 0) {
          productForCart.images = productForCart.selectedVariant.images;
        }
      } else {
        console.log('Cart:add: no variant match, clearing selected attributes');
        // No matching variant; treat as simple product by clearing attributes
        // so variantInfo is not created by the model
        for (const k of Object.keys(normalizedSelected)) delete normalizedSelected[k];
      }
    }

    console.log('Cart:add: productForCart =', {
      id: productForCart.id,
      hasSelectedVariant: Boolean(productForCart.selectedVariant),
      variantStock: productForCart.selectedVariant?.stock,
      variantPrice: productForCart.selectedVariant?.price,
      stock: productForCart.stock,
    });

    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({ user: req.user.id, items: [] });
    }

    // Add item to cart using the model method
    try {
      cart.addItem(productForCart, quantity, normalizedSelected);
      await cart.save();
    } catch (e) {
      console.error('Cart:add: save failed', e);
      return res.status(500).json({ success: false, message: e?.message || 'Failed to add item to cart' });
    }

    // Populate product details for response
    await cart.populate('items.product');

    res.status(201).json({ success: true, data: cart });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ success: false, message: 'Failed to add item to cart' });
  }
});

// Update cart item quantity
router.put('/me/items/:cartId', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { cartId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ success: false, message: 'Quantity is required' });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Update quantity using the model method
    cart.updateQuantity(cartId, quantity);
    await cart.save();

    // Populate product details for response
    await cart.populate('items.product');

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart item' });
  }
});

// Remove item from cart
router.delete('/me/items/:cartId', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { cartId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Remove item using the model method
    cart.removeItem(cartId);
    await cart.save();

    // Populate product details for response
    await cart.populate('items.product');

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ success: false, message: 'Failed to remove cart item' });
  }
});

// Clear cart
router.delete('/me', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Clear cart using the model method
    cart.clearCart();
    await cart.save();

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Failed to clear cart' });
  }
});

// Get cart summary (total, item count)
router.get('/me/summary', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return res.json({ success: true, data: { total: 0, itemCount: 0, items: [] } });
    }

    const total = cart.getTotal();
    const itemCount = cart.getItemCount();

    res.json({ 
      success: true, 
      data: { 
        total, 
        itemCount, 
        items: cart.items 
      } 
    });
  } catch (error) {
    console.error('Error getting cart summary:', error);
    res.status(500).json({ success: false, message: 'Failed to get cart summary' });
  }
});

module.exports = router;
// Apply coupon to cart
router.post('/me/coupon', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { couponCode } = req.body || {};
    if (!couponCode) return res.status(400).json({ success: false, message: 'couponCode is required' });
    const code = String(couponCode).toUpperCase();
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    if (!cart.items || cart.items.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });

    // Reuse validate logic
    const items = cart.items.map(ci => ({ product: ci.product._id || ci.product.id, price: ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? 0, quantity: ci.quantity }));
    const now = new Date();
    const coupon = await Coupon.findOne({ code, isActive: true, startDate: { $lte: now }, endDate: { $gte: now } }).lean();
    if (!coupon) return res.json({ success: false, message: 'Invalid or expired coupon' });
    const productIds = items.map(i => i.product);
    const products = await Product.find({ _id: { $in: productIds } }).select('_id vendor category').lean();
    const idToProduct = new Map(products.map(p => [String(p._id), p]));
    const applicable = (() => {
      if (coupon.appliesTo === 'all' || coupon.appliesTo === 'new_user') return items;
      if (coupon.appliesTo === 'vendor') return items.filter(it => {
        const p = idToProduct.get(String(it.product));
        return p && coupon.vendorIds && coupon.vendorIds.find(id => String(id) === String(p.vendor));
      });
      if (coupon.appliesTo === 'category') return items.filter(it => {
        const p = idToProduct.get(String(it.product));
        return p && coupon.categoryIds && coupon.categoryIds.find(id => String(id) === String(p.category));
      });
      if (coupon.appliesTo === 'product') return items.filter(it => coupon.productIds && coupon.productIds.find(id => String(id) === String(it.product)));
      return items;
    })();
    if (applicable.length === 0) return res.json({ success: false, message: 'Coupon does not apply to selected items' });
    const orderSubtotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
    if (coupon.minimumAmount && orderSubtotal < Number(coupon.minimumAmount)) return res.json({ success: false, message: `Minimum order amount is ${coupon.minimumAmount}` });
    const applicableSubtotal = applicable.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (applicableSubtotal * Number(coupon.discountValue || 0)) / 100;
      if (coupon.maximumDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
    } else {
      discountAmount = Number(coupon.discountValue || 0);
    }
    cart.couponCode = code;
    cart.couponDiscount = discountAmount;
    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, data: { cart, couponCode: code, discountAmount } });
  } catch (e) {
    console.error('Error applying coupon to cart:', e);
    res.status(500).json({ success: false, message: e?.message || 'Failed to apply coupon' });
  }
});

// Remove coupon from cart
router.delete('/me/coupon', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    cart.couponCode = null;
    cart.couponDiscount = 0;
    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, data: cart });
  } catch (e) {
    console.error('Error removing coupon from cart:', e);
    res.status(500).json({ success: false, message: e?.message || 'Failed to remove coupon' });
  }
});