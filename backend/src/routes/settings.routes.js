const express = require('express');

const router = express.Router();

// Public: shipping settings for clients
router.get('/shipping/public', async (req, res) => {
  try {
    // TODO: replace with persisted settings when admin settings backend is added
    const freeShippingThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 50);
    const defaultShippingCost = Number(process.env.DEFAULT_SHIPPING_COST || 9.99);
    res.json({ success: true, data: { freeShippingThreshold, defaultShippingCost } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load shipping settings' });
  }
});

module.exports = router;

