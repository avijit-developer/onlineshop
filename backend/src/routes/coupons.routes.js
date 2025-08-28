const express = require('express');
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { validateAndComputeCoupon } = require('../utils/coupons');
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
      perUserLimit: body.perUserLimit !== undefined ? Number(body.perUserLimit) : null,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      appliesTo: body.appliesTo || 'all',
      vendorIds: toObjectIdArray(body.vendorIds),
      categoryIds: toObjectIdArray(body.categoryIds),
      productIds: toObjectIdArray(body.productIds),
      freeShipping: !!body.freeShipping,
      allowedPaymentMethods: Array.isArray(body.allowedPaymentMethods) ? Array.from(new Set(body.allowedPaymentMethods.map(String))) : [],
      ruleType: body.ruleType || 'standard',
      bogoBuyProductIds: toObjectIdArray(body.bogoBuyProductIds),
      bogoGetProductIds: toObjectIdArray(body.bogoGetProductIds),
      bogoBuyQty: body.bogoBuyQty != null ? Number(body.bogoBuyQty) : 1,
      bogoGetQty: body.bogoGetQty != null ? Number(body.bogoGetQty) : 1,
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
      perUserLimit: body.perUserLimit !== undefined ? Number(body.perUserLimit) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      appliesTo: body.appliesTo,
      vendorIds: Array.isArray(body.vendorIds) ? toObjectIdArray(body.vendorIds) : undefined,
      categoryIds: Array.isArray(body.categoryIds) ? toObjectIdArray(body.categoryIds) : undefined,
      productIds: Array.isArray(body.productIds) ? toObjectIdArray(body.productIds) : undefined,
      freeShipping: body.freeShipping !== undefined ? !!body.freeShipping : undefined,
      allowedPaymentMethods: Array.isArray(body.allowedPaymentMethods) ? Array.from(new Set(body.allowedPaymentMethods.map(String))) : undefined,
      ruleType: body.ruleType,
      bogoBuyProductIds: Array.isArray(body.bogoBuyProductIds) ? toObjectIdArray(body.bogoBuyProductIds) : undefined,
      bogoGetProductIds: Array.isArray(body.bogoGetProductIds) ? toObjectIdArray(body.bogoGetProductIds) : undefined,
      bogoBuyQty: body.bogoBuyQty != null ? Number(body.bogoBuyQty) : undefined,
      bogoGetQty: body.bogoGetQty != null ? Number(body.bogoGetQty) : undefined,
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
    const { couponCode, items, paymentMethod } = req.body || {};
    if (!couponCode) return res.status(400).json({ success: false, message: 'couponCode is required' });

    // Build items list with product refs
    let orderItems = Array.isArray(items) ? items : [];
    if (orderItems.length === 0) {
      const Cart = require('../models/Cart');
      const cart = await Cart.findOne({ user: req.user.id }).lean();
      if (!cart || (cart.items || []).length === 0) {
        return res.json({ success: false, message: 'Cart is empty' });
      }
      orderItems = (cart.items || []).map(ci => ({
        product: ci.product,
        price: ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? ci.product?.specialPrice ?? ci.product?.regularPrice ?? 0,
        quantity: ci.quantity
      }));
    }

    const result = await validateAndComputeCoupon({ couponCode, items: orderItems, userId: req.user.id, paymentMethod });
    if (!result.valid) return res.json({ success: false, message: result.message || 'Coupon invalid' });
    return res.json({ success: true, data: { couponCode: String(couponCode).toUpperCase(), discountAmount: result.discountAmount, applicableSubtotal: result.applicableSubtotal, freeShipping: !!result.freeShipping } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to validate coupon' });
  }
});

module.exports = router;

