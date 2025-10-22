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
