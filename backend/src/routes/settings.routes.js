const express = require('express');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public: shipping settings for clients (flat fee only)
router.get('/shipping/public', async (req, res) => {
  try {
    const doc = await Settings.findOne().lean();
    const flatShippingFee = doc?.shipping?.flatShippingFee ?? Number(process.env.FLAT_SHIPPING_FEE || 0);
    const taxRate = doc?.tax?.rate ?? Number(process.env.DEFAULT_TAX_RATE || 0);
    const contactEmail = doc?.general?.contactEmail || '';
    const contactPhone = doc?.general?.contactPhone || '';
    // Return fee, tax rate and general contact for client consumption
    res.json({ success: true, data: { flatShippingFee, taxRate, contactEmail, contactPhone } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load shipping settings' });
  }
});

module.exports = router;
// Admin: get full settings
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const doc = await Settings.findOne();
    res.json({ success: true, data: doc || {} });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load settings' });
  }
});

// Admin: upsert settings
router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const updated = await Settings.findOneAndUpdate({}, payload, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to save settings' });
  }
});

