const express = require('express');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendMail, buildEmailHtml } = require('../utils/mailer');

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

// Public: contact us form
router.post('/contact', async (req, res) => {
  try {
    const { name = '', email = '', phone = '', comments = '' } = req.body || {};
    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedPhone = String(phone).trim();
    const trimmedComments = String(comments).trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedComments) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and comments are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const settings = await Settings.findOne().select('general').lean();
    const contactEmail = String(settings?.general?.contactEmail || '').trim();
    if (!contactEmail) {
      return res.status(400).json({ success: false, message: 'Contact email is not configured yet' });
    }

    const subject = `Contact Us message from ${trimmedName}`;
    const contentHtml = `
      <p>You received a new Contact Us enquiry from the mobile app.</p>
      <p><b>Name:</b> ${trimmedName}</p>
      <p><b>Email:</b> ${trimmedEmail}</p>
      <p><b>Phone:</b> ${trimmedPhone}</p>
      <p><b>Comments:</b><br/>${trimmedComments.replace(/\n/g, '<br/>')}</p>
    `;
    const html = await buildEmailHtml({ subject, contentHtml });
    await sendMail({
      to: contactEmail,
      subject,
      html,
      text: `Name: ${trimmedName}\nEmail: ${trimmedEmail}\nPhone: ${trimmedPhone}\nComments:\n${trimmedComments}`,
    });

    return res.json({ success: true, message: 'Your message has been sent successfully' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || 'Failed to send contact message' });
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
