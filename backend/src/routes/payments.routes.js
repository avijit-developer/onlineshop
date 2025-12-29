const express = require('express');
const mongoose = require('mongoose');
const { authenticate, requireAdmin } = require('../middleware/auth');
const Order = require('../models/Order');
const Payout = require('../models/Payout');

const router = express.Router();

const COMPLETED_STATUSES = new Set(['delivered', 'completed']);

const toLowerStatus = (value) => String(value || '').trim().toLowerCase();

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.toString === 'function') {
    return value.toString();
  }
  return String(value);
};

const matchesStatusFilter = (statusLower, filterLower) => {
  if (!filterLower || filterLower === 'all') return true;
  if (filterLower === 'completed') return COMPLETED_STATUSES.has(statusLower);
  return statusLower === filterLower;
};

const getVendorStatus = (order, vendorId) => {
  const key = normalizeId(vendorId);
  let vendorStatus = null;
  if (order?.vendorStatuses) {
    if (typeof order.vendorStatuses.get === 'function') {
      vendorStatus = order.vendorStatuses.get(key) || order.vendorStatuses.get(vendorId);
    } else if (typeof order.vendorStatuses === 'object') {
      vendorStatus = order.vendorStatuses[key] || order.vendorStatuses[vendorId];
    }
  }
  if (!vendorStatus && Array.isArray(order?.vendorStatusHistory)) {
    const match = order.vendorStatusHistory.slice().reverse().find((entry) => normalizeId(entry.vendor) === key);
    vendorStatus = match?.status || null;
  }
  return toLowerStatus(vendorStatus || order?.status || 'pending');
};

async function computeVendorBalance(vendorId, statusFilter = 'completed') {
  const vendorIdStr = normalizeId(vendorId);
  if (!vendorIdStr || !mongoose.Types.ObjectId.isValid(vendorIdStr)) {
    return { vendorEarnings: 0, paid: 0, due: 0 };
  }
  const vendorObjectId = new mongoose.Types.ObjectId(vendorIdStr);
  const orders = await Order.find({ 'items.vendor': vendorObjectId }).lean();
  let vendorEarnings = 0;
  for (const order of orders) {
    const vendorStatusLower = getVendorStatus(order, vendorIdStr);
    if (!matchesStatusFilter(vendorStatusLower, statusFilter)) continue;
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (normalizeId(item.vendor) !== vendorIdStr) continue;
      const qty = Number(item.quantity || 0);
      if (!(qty > 0)) continue;
      const vendorUnit = Number(
        item.vendorUnitPrice ??
        item.vendorPrice ??
        0
      );
      vendorEarnings += vendorUnit * qty;
    }
  }
  const payouts = await Payout.find({ vendor: vendorObjectId }).lean();
  const paid = payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const due = Math.max(0, vendorEarnings - paid);
  return { vendorEarnings, paid, due };
}

// Admin earnings per vendor per order
router.get('/admin-earnings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to, status } = req.query || {};
    const statusFilter = toLowerStatus(status || 'completed');
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (statusFilter && statusFilter !== 'completed' && statusFilter !== 'all') {
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
        const vendorId = normalizeId(it.vendor);
        if (!vendorId) continue;
        const qty = Number(it.quantity || 0);
        const customerUnit = Number(it.price || 0);
        const vendorUnit = Number(
          it.vendorUnitPrice ??
          it.vendorPrice ??
          0
        );
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
        const vendorStatusLower = getVendorStatus(o, agg.vendorId);
        if (!matchesStatusFilter(vendorStatusLower, statusFilter)) continue;
        entries.push({
          id: `${o._id}_${agg.vendorId}`,
          orderId: o.orderNumber || String(o._id).slice(-6),
          customerName: (o.user && (o.user.name || o.user.email)) || '',
          amount: agg.customerSubtotal || orderTotal,
          commission: Math.max(0, agg.adminMargin),
          vendorEarnings: Math.max(0, agg.vendorEarnings),
          paymentMethod: o.paymentMethod || '',
          status: vendorStatusLower || toLowerStatus(o.status),
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
    const numericAmount = Number(amount);
    if (!vendorId || !(numericAmount > 0)) return res.status(400).json({ success: false, message: 'vendorId and positive amount required' });

    const amountValue = Math.round(numericAmount * 100) / 100;
    const { due } = await computeVendorBalance(vendorId, 'completed');
    if (!(due > 0)) {
      return res.status(400).json({ success: false, message: 'Vendor has no payable balance' });
    }
    if (amountValue - due > 0.01) {
      return res.status(400).json({ success: false, message: 'Payout exceeds available balance' });
    }

    const doc = await Payout.create({ vendor: vendorId, amount: amountValue, method: method || 'Manual', note: note || '', processedBy: req.user?.id });
    return res.status(201).json({ success: true, data: { id: doc._id, vendorId: doc.vendor, amount: doc.amount, method: doc.method, note: doc.note, createdAt: doc.createdAt } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to record payout' });
  }
});

router.delete('/payouts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout not found' });
    }
    await payout.deleteOne();
    return res.json({ success: true, message: 'Payout deleted' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to delete payout' });
  }
});

router.get('/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { vendorId, from, to } = req.query || {};
    const query = {};
    if (vendorId) query.vendor = vendorId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const payouts = await Payout.find(query)
      .sort({ createdAt: -1 })
      .populate('vendor', 'companyName email phone')
      .populate('processedBy', 'name email')
      .lean();

    const data = payouts.map((p) => ({
      id: p._id.toString(),
      vendorId: normalizeId(p.vendor?._id || p.vendor),
      vendorName: p.vendor?.companyName || 'Unknown Vendor',
      vendorEmail: p.vendor?.email || '',
      amount: Number(p.amount || 0),
      method: p.method || 'Manual',
      note: p.note || '',
      status: 'approved',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      processedBy: p.processedBy?.name || p.processedBy?.email || '',
    }));

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch payouts' });
  }
});

// GET /api/v1/payments/vendor-summary?from=...&to=...&vendorId=...
// Returns per-vendor aggregates: earnings, adminCommission, paid (sum of payouts), due = earnings - paid
router.get('/vendor-summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to, vendorId, status } = req.query || {};
    const statusFilter = toLowerStatus(status || 'completed');
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (statusFilter && statusFilter !== 'completed' && statusFilter !== 'all') {
      query.status = status;
    }
    const orders = await Order.find(query).lean();
    const sums = new Map();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const vid = normalizeId(it.vendor);
        if (!vid) continue;
        if (vendorId && String(vendorId) !== vid) continue;
        const vendorStatusLower = getVendorStatus(o, vid);
        if (!matchesStatusFilter(vendorStatusLower, statusFilter)) continue;
        const qty = Number(it.quantity || 0);
        const customerUnit = Number(it.price || 0);
        const vendorUnit = Number(
          it.vendorUnitPrice ??
          it.vendorPrice ??
          0
        );
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

// GET /api/v1/payments/vendor-report?vendorId=...
// Vendor-specific payment report with earnings, payouts, and balance
router.get('/vendor-report', authenticate, async (req, res) => {
  try {
    const { vendorId } = req.query || {};
    const vendorIdStr = normalizeId(vendorId);
    
    // For vendor users, use their vendorId
    let targetVendorId = vendorIdStr;
    if (req.user.role === 'vendor') {
      const userVendorId = req.user.vendorId || (req.user.vendors && req.user.vendors[0]);
      if (userVendorId) {
        targetVendorId = normalizeId(userVendorId);
      } else {
        return res.status(403).json({ success: false, message: 'Vendor ID not found' });
      }
    } else if (!targetVendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID required' });
    }
    
    if (!targetVendorId || !mongoose.Types.ObjectId.isValid(targetVendorId)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
    }
    
    // Get vendor balance
    const balance = await computeVendorBalance(targetVendorId, 'completed');
    
    // Get vendor orders for payment history
    const vendorObjectId = new mongoose.Types.ObjectId(targetVendorId);
    const orders = await Order.find({ 'items.vendor': vendorObjectId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    const payments = [];
    for (const o of orders) {
      const vendorStatusLower = getVendorStatus(o, targetVendorId);
      if (!COMPLETED_STATUSES.has(vendorStatusLower)) continue;
      
      const items = Array.isArray(o.items) ? o.items : [];
      let vendorEarnings = 0;
      let orderTotal = 0;
      
      for (const it of items) {
        if (normalizeId(it.vendor) !== targetVendorId) continue;
        const qty = Number(it.quantity || 0);
        const customerUnit = Number(it.price || 0);
        const vendorUnit = Number(it.vendorUnitPrice ?? it.vendorPrice ?? 0);
        vendorEarnings += vendorUnit * qty;
        orderTotal += customerUnit * qty;
      }
      
      if (vendorEarnings > 0) {
        payments.push({
          id: `${o._id}_${targetVendorId}`,
          orderId: o.orderNumber || String(o._id).slice(-6),
          customerName: (o.user && (o.user.name || o.user.email)) || '',
          amount: orderTotal,
          vendorEarnings: vendorEarnings,
          paymentMethod: o.paymentMethod || '',
          status: vendorStatusLower,
          date: o.createdAt,
        });
      }
    }
    
    // Get payout history
    const payouts = await Payout.find({ vendor: vendorObjectId })
      .sort({ createdAt: -1 })
      .populate('processedBy', 'name email')
      .lean();
    
    const payoutHistory = payouts.map((p) => ({
      id: p._id.toString(),
      vendorId: targetVendorId,
      amount: Number(p.amount || 0),
      method: p.method || 'Manual',
      note: p.note || '',
      status: 'approved',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      processedBy: p.processedBy?.name || p.processedBy?.email || '',
    }));
    
    res.json({
      success: true,
      data: {
        vendorId: targetVendorId,
        totalEarnings: balance.vendorEarnings,
        totalPaid: balance.paid,
        balance: balance.due,
        payments: payments,
        payouts: payoutHistory
      }
    });
  } catch (e) {
    console.error('Vendor report error:', e);
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch vendor report' });
  }
});