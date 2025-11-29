const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate, requireRole } = require('../middleware/auth');
const Coupon = require('../models/Coupon');
const { validateAndComputeCoupon } = require('../utils/coupons');

const router = express.Router();

async function populateCartItems(cart) {
  if (!cart) return cart;
  await cart.populate({
    path: 'items.product',
    populate: { path: 'vendor', select: 'enabled status' }
  });
  cart.items.forEach(item => {
    let product = item.product;
    if (!product) {
      product = {
        _id: null,
        name: 'Unavailable product',
        enabled: false,
        status: 'unavailable',
        images: [],
        regularPrice: null,
        specialPrice: null,
        stock: 0
      };
      item.product = product;
      return;
    }
    const vendor = product.vendor;
    const vendorStatus = typeof vendor?.status === 'string' ? vendor.status.toLowerCase() : '';
    const productStatus = typeof product.status === 'string' ? product.status.toLowerCase() : '';
    if (!vendor || vendor.enabled === false || vendorStatus !== 'approved' || product.enabled === false || productStatus !== 'approved') {
      product.enabled = false;
    }
  });
  return cart;
}

// Get user's cart
router.get('/me', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = new Cart({ user: req.user.id, items: [] });
      await cart.save();
    }

    await populateCartItems(cart);
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
    const productDoc = await Product.findById(bodyProductId).populate('vendor', 'enabled status');
    if (!productDoc) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // Only approved, enabled products can be added to cart for customers
    const productStatus = typeof productDoc.status === 'string'
      ? productDoc.status.toLowerCase()
      : '';
    if (productStatus !== 'approved' || !productDoc.enabled) {
      return res.status(400).json({ success: false, message: 'Product not available for purchase' });
    }
    const vendorStatus = typeof productDoc.vendor?.status === 'string'
      ? productDoc.vendor.status.toLowerCase()
      : '';
    if (!productDoc.vendor || productDoc.vendor.enabled === false || vendorStatus !== 'approved') {
      console.warn('Cart:add blocked due to vendor state', {
        product: bodyProductId,
        vendor: productDoc.vendor?._id || productDoc.vendor,
        vendorEnabled: productDoc.vendor?.enabled,
        vendorStatus: productDoc.vendor?.status
      });
      return res.status(400).json({ success: false, message: 'Vendor not available for purchase' });
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
      // Use admin-controlled prices for customer carts; include vendor base for vendor-side reporting later
      regularPrice: productDoc.regularPrice,
      specialPrice: productDoc.specialPrice,
      vendorRegularPrice: productDoc.vendorRegularPrice,
      // no vendorSpecialPrice
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
          // For customers, price is driven by admin-set price; variant-level falls back
          price: foundVariant.price ?? productDoc.regularPrice,
          specialPrice: foundVariant.specialPrice ?? productDoc.specialPrice,
          vendorPrice: foundVariant.vendorPrice ?? productDoc.vendorRegularPrice,
          // no vendorSpecialPrice
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
      // Invalidate previously applied coupon when cart content changes
      cart.couponCode = null;
      cart.couponDiscount = 0;
      cart.freeShippingApplied = false;
      await cart.save();
    } catch (e) {
      console.error('Cart:add: save failed', e);
      return res.status(500).json({ success: false, message: e?.message || 'Failed to add item to cart' });
    }

    // Populate product details for response
    await populateCartItems(cart);

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
    // Invalidate coupon when cart content changes
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.freeShippingApplied = false;
    await cart.save();

    // Populate product details for response
    await populateCartItems(cart);

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
    // Invalidate coupon when cart content changes
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.freeShippingApplied = false;
    await cart.save();

    // Populate product details for response
    await populateCartItems(cart);

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
      // Idempotent: nothing to clear
      return res.json({ success: true, data: { items: [], couponCode: null, couponDiscount: 0, freeShippingApplied: false } });
    }

    // Clear cart using the model method
    cart.clearCart();
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.freeShippingApplied = false;
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
    const { couponCode, paymentMethod } = req.body || {};
    if (!couponCode) return res.status(400).json({ success: false, message: 'couponCode is required' });
    const code = String(couponCode).toUpperCase();
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    if (!cart.items || cart.items.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });

    const items = cart.items.map(ci => ({
      product: ci.product._id || ci.product.id,
      price: ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? ci.product?.specialPrice ?? ci.product?.regularPrice ?? 0,
      quantity: ci.quantity
    }));
    const result = await validateAndComputeCoupon({ couponCode: code, items, userId: req.user.id, paymentMethod });
    if (!result.valid) return res.json({ success: false, message: result.message || 'Coupon invalid' });

    cart.couponCode = code;
    cart.couponDiscount = result.discountAmount || 0;
    cart.freeShippingApplied = !!result.freeShipping;
    await cart.save();
    await populateCartItems(cart);
    return res.json({ success: true, data: { cart, couponCode: code, discountAmount: result.discountAmount, freeShipping: !!result.freeShipping } });
  } catch (e) {
    console.error('Error applying coupon to cart:', e);
    res.status(500).json({ success: false, message: e?.message || 'Failed to apply coupon' });
  }
});

// Remove coupon from cart
router.delete('/me/coupon', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.freeShippingApplied = false;
    await cart.save();
    await populateCartItems(cart);
    return res.json({ success: true, data: cart });
  } catch (e) {
    console.error('Error removing coupon from cart:', e);
    res.status(500).json({ success: false, message: e?.message || 'Failed to remove coupon' });
  }
});