const express = require('express');
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { authenticate, requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// List coupons with filters and pagination
router.get('/', authenticate, requireRole(['admin','vendor']), async (req, res) => {
  try {
    const { q = '', status = 'all', page = 1, limit = 10 } = req.query;
    const filters = {};
    if (q) {
      const regex = new RegExp(String(q), 'i');
      filters.$or = [
        { code: { $regex: regex } },
        { name: { $regex: regex } },
        { description: { $regex: regex } }
      ];
    }
    if (status !== 'all') {
      if (status === 'active') filters.isActive = true; else if (status === 'inactive') filters.isActive = false;
    }
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const [items, total] = await Promise.all([
      Coupon.find(filters).sort({ createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
      Coupon.countDocuments(filters)
    ]);
    res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch coupons' });
  }
});

function uniqueIdArray(arr) {
  if (!Array.isArray(arr)) return [];
  const set = new Set(arr.map(v => String(v)));
  return Array.from(set);
}

function toObjectIdArray(arr) {
  return uniqueIdArray(arr).map(id => new mongoose.Types.ObjectId(id));
}

// Create coupon
router.post('/', authenticate, requireRole(['admin']), requirePermission('coupons.add'), async (req, res) => {
  try {
    const body = req.body || {};
    const required = ['code','name','discountType','discountValue','usageLimit','startDate','endDate'];
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        res.status(400); throw new Error(`${f} is required`);
      }
    }
    const payload = {
      code: String(body.code).toUpperCase().trim(),
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : '',
      discountType: body.discountType,
      discountValue: Number(body.discountValue) || 0,
      minimumAmount: body.minimumAmount !== undefined ? Number(body.minimumAmount) : 0,
      maximumDiscount: body.maximumDiscount !== undefined ? Number(body.maximumDiscount) : null,
      usageLimit: Number(body.usageLimit) || 0,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      appliesTo: body.appliesTo || 'all',
      vendorIds: toObjectIdArray(body.vendorIds),
      categoryIds: toObjectIdArray(body.categoryIds),
      productIds: toObjectIdArray(body.productIds),
    };
    const created = await Coupon.create(payload);
    res.json({ success: true, data: created });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to create coupon' });
  }
});

// Update coupon
router.put('/:id', authenticate, requireRole(['admin']), requirePermission('coupons.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const payload = {
      code: body.code ? String(body.code).toUpperCase().trim() : undefined,
      name: body.name ? String(body.name).trim() : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      discountType: body.discountType,
      discountValue: body.discountValue !== undefined ? Number(body.discountValue) : undefined,
      minimumAmount: body.minimumAmount !== undefined ? Number(body.minimumAmount) : undefined,
      maximumDiscount: body.maximumDiscount !== undefined ? Number(body.maximumDiscount) : undefined,
      usageLimit: body.usageLimit !== undefined ? Number(body.usageLimit) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      appliesTo: body.appliesTo,
      vendorIds: Array.isArray(body.vendorIds) ? toObjectIdArray(body.vendorIds) : undefined,
      categoryIds: Array.isArray(body.categoryIds) ? toObjectIdArray(body.categoryIds) : undefined,
      productIds: Array.isArray(body.productIds) ? toObjectIdArray(body.productIds) : undefined,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    const updated = await Coupon.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to update coupon' });
  }
});

// Delete coupon
router.delete('/:id', authenticate, requireRole(['admin']), requirePermission('coupons.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data: deleted });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to delete coupon' });
  }
});

// Toggle status
router.patch('/:id/status', authenticate, requireRole(['admin']), requirePermission('coupons.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};
    const updated = await Coupon.findByIdAndUpdate(id, { isActive: !!isActive }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to update status' });
  }
});

// Validate coupon against current user's cart or provided items
router.post('/validate', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { couponCode, items } = req.body || {};
    if (!couponCode) return res.status(400).json({ success: false, message: 'couponCode is required' });
    const code = String(couponCode).toUpperCase();
    const now = new Date();
    const coupon = await Coupon.findOne({ code, isActive: true, startDate: { $lte: now }, endDate: { $gte: now } }).lean();
    if (!coupon) {
      console.warn('[Coupon Validate] Not found or inactive/expired:', code);
      return res.json({ success: false, message: 'Invalid or expired coupon' });
    }

    // Build items list with product refs
    let orderItems = Array.isArray(items) ? items : [];
    if (orderItems.length === 0) {
      const Cart = require('../models/Cart');
      const cart = await Cart.findOne({ user: req.user.id }).lean();
      if (!cart || (cart.items || []).length === 0) {
        console.warn('[Coupon Validate] Empty cart for user:', req.user.id);
        return res.json({ success: false, message: 'Cart is empty' });
      }
      orderItems = (cart.items || []).map(ci => ({ product: ci.product, price: ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? 0, quantity: ci.quantity }));
    }

    const productIds = orderItems.map(i => i.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).select('_id vendor category').lean();
    const idToProduct = new Map(products.map(p => [String(p._id), p]));

    // Compute applicable subtotal based on appliesTo
    const getApplicable = () => {
      if (coupon.appliesTo === 'new_user') return orderItems; // subtotal later if user is new
      if (coupon.appliesTo === 'all') return orderItems;
      if (coupon.appliesTo === 'vendor') return orderItems.filter(it => {
        const p = idToProduct.get(String(it.product));
        return p && coupon.vendorIds && coupon.vendorIds.find(id => String(id) === String(p.vendor));
      });
      if (coupon.appliesTo === 'category') return orderItems.filter(it => {
        const p = idToProduct.get(String(it.product));
        return p && coupon.categoryIds && coupon.categoryIds.find(id => String(id) === String(p.category));
      });
      if (coupon.appliesTo === 'product') return orderItems.filter(it => coupon.productIds && coupon.productIds.find(id => String(id) === String(it.product)));
      return orderItems;
    };

    // Check new user condition
    if (coupon.appliesTo === 'new_user') {
      const Order = require('../models/Order');
      const existing = await Order.countDocuments({ user: req.user.id });
      if (existing > 0) {
        console.warn('[Coupon Validate] Not a new user:', req.user.id);
        return res.json({ success: false, message: 'Coupon valid for new users only' });
      }
    }

    const applicable = getApplicable();
    if (applicable.length === 0) {
      console.warn('[Coupon Validate] No applicable items for coupon:', code);
      return res.json({ success: false, message: 'Coupon does not apply to selected items' });
    }

    const applicableSubtotal = applicable.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
    const orderSubtotal = orderItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
    if (coupon.minimumAmount && orderSubtotal < Number(coupon.minimumAmount)) {
      console.warn('[Coupon Validate] Below minimum amount:', { required: coupon.minimumAmount, orderSubtotal });
      return res.json({ success: false, message: `Minimum order amount is ${coupon.minimumAmount}` });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (applicableSubtotal * Number(coupon.discountValue || 0)) / 100;
      if (coupon.maximumDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
    } else {
      discountAmount = Number(coupon.discountValue || 0);
    }

    return res.json({ success: true, data: { couponCode: code, discountAmount, applicableSubtotal } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to validate coupon' });
  }
});

module.exports = router;

