const express = require('express');
const Coupon = require('../models/Coupon');

const router = express.Router();

// Public: shipping settings for clients
router.get('/shipping/public', async (req, res) => {
  try {
    // Compute free shipping threshold from active free-shipping coupons (global), fallback to env
    const now = new Date();
    let freeShippingThreshold = null;
    try {
      const freeCoupons = await Coupon.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        freeShipping: true,
        appliesTo: 'all',
        minimumAmount: { $ne: null }
      }).sort({ minimumAmount: 1 }).select('minimumAmount').lean();
      if (freeCoupons && freeCoupons.length > 0) {
        freeShippingThreshold = Number(freeCoupons[0].minimumAmount || 0);
      }
    } catch (_) {}
    if (freeShippingThreshold == null || Number.isNaN(freeShippingThreshold)) {
      freeShippingThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 50);
    }
    const defaultShippingCost = Number(process.env.DEFAULT_SHIPPING_COST || 9.99);
    res.json({ success: true, data: { freeShippingThreshold, defaultShippingCost } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load shipping settings' });
  }
});

module.exports = router;

