const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const Order = require('../models/Order');
const Payout = require('../models/Payout');

const router = express.Router();

// Admin earnings per vendor per order
router.get('/admin-earnings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to, status } = req.query || {};
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    const s = String(status || '').toLowerCase();
    if (!s || s === 'completed') {
      // Treat delivered and completed as completed
      query.status = { $in: ['delivered', 'completed'] };
    } else if (s !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query).populate('user', 'name email').lean();
    const entries = [];

    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      const orderSubtotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      const taxPercent = Number(o.tax || 0);
      const taxAmount = (orderSubtotal * taxPercent) / 100;
      const shipping = Number(o.shippingCost || 0);
      const discount = Number(o.discountAmount || 0);
      const orderTotal = Math.max(0, orderSubtotal + taxAmount + shipping - discount);

      const vendorMap = new Map();
      for (const it of items) {
        const vendorId = String(it.vendor || '');
        if (!vendorId) continue;
        const qty = Number(it.quantity || 0);
        const customerUnit = Number(it.price || 0);
        const vendorUnit = Number(it.vendorUnitPrice || 0);
        const vendorEarnings = vendorUnit * qty;
        const adminMargin = (customerUnit - vendorUnit) * qty;
        const customerLineTotal = customerUnit * qty;
        if (!vendorMap.has(vendorId)) vendorMap.set(vendorId, { vendorId, vendorEarnings: 0, adminMargin: 0, customerSubtotal: 0 });
        const agg = vendorMap.get(vendorId);
        agg.vendorEarnings += vendorEarnings;
        agg.adminMargin += adminMargin;
        agg.customerSubtotal += customerLineTotal;
      }

      for (const [, agg] of vendorMap.entries()) {
        entries.push({
          id: `${o._id}_${agg.vendorId}`,
          orderId: o.orderNumber || String(o._id).slice(-6),
          customerName: (o.user && (o.user.name || o.user.email)) || '',
          amount: orderTotal,
          commission: Math.max(0, agg.adminMargin),
          vendorEarnings: Math.max(0, agg.vendorEarnings),
          paymentMethod: o.paymentMethod || '',
          status: o.status || 'pending',
          date: o.createdAt,
          vendorId: agg.vendorId,
          taxAmount,
          shipping,
          discount,
        });
      }
    }

    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to compute admin earnings' });
  }
});

module.exports = router;
// Vendor payout ledger (in-memory for now) could be persisted later
// POST /api/v1/payments/payouts { vendorId, amount, note }
router.post('/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { vendorId, amount, method, note } = req.body || {};
    if (!vendorId || !(Number(amount) > 0)) return res.status(400).json({ success: false, message: 'vendorId and positive amount required' });
    const doc = await Payout.create({ vendor: vendorId, amount: Number(amount), method: method || 'Manual', note: note || '', processedBy: req.user?.id });
    return res.status(201).json({ success: true, data: { id: doc._id, vendorId: doc.vendor, amount: doc.amount, method: doc.method, note: doc.note, createdAt: doc.createdAt } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to record payout' });
  }
});

// GET /api/v1/payments/vendor-summary?from=...&to=...&vendorId=...
// Returns per-vendor aggregates: earnings, adminCommission, paid (sum of payouts), due = earnings - paid
router.get('/vendor-summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to, vendorId, status } = req.query || {};
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const s = String(status || '').toLowerCase();
    if (!s || s === 'completed') {
      query.status = { $in: ['delivered', 'completed'] };
    } else if (s !== 'all') {
      query.status = status;
    }
    const orders = await Order.find(query).lean();
    const sums = new Map();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const vid = String(it.vendor || '');
        if (!vid) continue;
        if (vendorId && String(vendorId) !== vid) continue;
        const qty = Number(it.quantity || 0);
        const customerUnit = Number(it.price || 0);
        const vendorUnit = Number(it.vendorUnitPrice || 0);
        const vendorEarn = vendorUnit * qty;
        const adminEarn = (customerUnit - vendorUnit) * qty;
        if (!sums.has(vid)) sums.set(vid, { vendorId: vid, vendorEarnings: 0, adminCommission: 0 });
        const agg = sums.get(vid);
        agg.vendorEarnings += vendorEarn;
        agg.adminCommission += adminEarn;
      }
    }
    // Sum payouts
    const payoutQuery = {};
    if (vendorId) payoutQuery.vendor = vendorId;
    const payouts = await Payout.find(payoutQuery).lean();
    const paidMap = new Map();
    for (const p of payouts) {
      const vid = String(p.vendor);
      paidMap.set(vid, (paidMap.get(vid) || 0) + Number(p.amount || 0));
    }
    const result = Array.from(sums.values()).map(r => {
      const paid = paidMap.get(String(r.vendorId)) || 0;
      return { ...r, paid, due: Math.max(0, r.vendorEarnings - paid) };
    });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to compute vendor summary' });
  }
});
