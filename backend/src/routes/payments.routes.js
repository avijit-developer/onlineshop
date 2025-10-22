const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const Order = require('../models/Order');

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
    if (status && String(status).toLowerCase() !== 'all') {
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
    const { vendorId, amount } = req.body || {};
    if (!vendorId || !(Number(amount) > 0)) return res.status(400).json({ success: false, message: 'vendorId and positive amount required' });
    // In a real system, persist payout record in DB. For now, return OK (frontend keeps its own record) 
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to record payout' });
  }
});

// GET /api/v1/payments/vendor-summary?from=...&to=...&vendorId=...
// Returns per-vendor aggregates: totalVendorEarnings, totalAdminCommission, totalPaid (0 for now), due = earnings - paid, date range
router.get('/vendor-summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to, vendorId } = req.query || {};
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
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
    const result = Array.from(sums.values()).map(r => ({ ...r, paid: 0, due: r.vendorEarnings - 0 }));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to compute vendor summary' });
  }
});
