const express = require('express');
const Coupon = require('../models/Coupon');
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
      vendorIds: uniqueIdArray(body.vendorIds),
      categoryIds: uniqueIdArray(body.categoryIds),
      productIds: uniqueIdArray(body.productIds),
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
      vendorIds: Array.isArray(body.vendorIds) ? uniqueIdArray(body.vendorIds) : undefined,
      categoryIds: Array.isArray(body.categoryIds) ? uniqueIdArray(body.categoryIds) : undefined,
      productIds: Array.isArray(body.productIds) ? uniqueIdArray(body.productIds) : undefined,
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

module.exports = router;

