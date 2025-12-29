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
    const minAppVersion = doc?.general?.minAppVersion || process.env.MIN_APP_VERSION || '';
    // Return delivery area settings for client validation
    const deliveryArea = doc?.deliveryArea ? {
      latitude: doc.deliveryArea.latitude,
      longitude: doc.deliveryArea.longitude,
      radius: doc.deliveryArea.radius
    } : null;
    // Return fee, tax rate and general contact for client consumption
    res.json({ success: true, data: { flatShippingFee, taxRate, contactEmail, contactPhone, minAppVersion, deliveryArea } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load shipping settings' });
  }
});

// Public: email settings for SMTP (expose only email identifier)
router.get('/email/public', async (req, res) => {
  try {
    const doc = await Settings.findOne().select('email').lean();
    res.json({ success: true, data: { email: doc?.email?.email || '' } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load email settings' });
  }
});

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
    
    // Ensure lowStockQuantity is a number if provided
    if (payload.general && payload.general.lowStockQuantity !== undefined) {
      payload.general.lowStockQuantity = parseInt(payload.general.lowStockQuantity) || 10;
    }
    
    // Find existing settings or create new one
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create new settings document
      settings = new Settings(payload);
      await settings.save();
    } else {
      // Update existing settings - merge nested objects properly
      if (payload.general) {
        settings.general = { ...settings.general.toObject(), ...payload.general };
      }
      if (payload.localization) {
        settings.localization = { ...settings.localization.toObject(), ...payload.localization };
      }
      if (payload.shipping) {
        settings.shipping = { ...settings.shipping.toObject(), ...payload.shipping };
      }
      if (payload.tax) {
        settings.tax = { ...settings.tax.toObject(), ...payload.tax };
      }
      if (payload.email) {
        settings.email = { ...settings.email.toObject(), ...payload.email };
      }
      if (payload.deliveryArea) {
        settings.deliveryArea = { ...settings.deliveryArea.toObject(), ...payload.deliveryArea };
      }
      
      await settings.save();
    }
    
    res.json({ success: true, data: settings });
  } catch (e) {
    console.error('Settings save error:', e);
    res.status(500).json({ success: false, message: e?.message || 'Failed to save settings' });
  }
});

module.exports = router;
