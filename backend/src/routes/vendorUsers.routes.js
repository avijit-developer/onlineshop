const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');
const VendorUser = require('../models/VendorUser');
const Vendor = require('../models/Vendor');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// List vendor users (admin-only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { vendor, q = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  if (vendor) filters.vendor = vendor;
  if (q) {
    filters.$or = [
      { name: { $regex: String(q), $options: 'i' } },
      { email: { $regex: String(q), $options: 'i' } }
    ];
  }
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    VendorUser.find(filters).populate('vendor', 'companyName').skip((pageNum - 1) * perPage).limit(perPage).lean(),
    VendorUser.countDocuments(filters)
  ]);
  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// Create vendor user (admin-only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password, vendor, permissions = [] } = req.body || {};
  if (!name || !email || !password || !vendor) {
    res.status(400);
    throw new Error('name, email, password and vendor are required');
  }
  if (!isValidEmail(email)) { res.status(400); throw new Error('Invalid email format'); }
  if (String(password).length < 8) { res.status(400); throw new Error('Password must be at least 8 characters'); }
  const v = await Vendor.findById(vendor).lean();
  if (!v) { res.status(400); throw new Error('Vendor not found'); }

  const exists = await VendorUser.findOne({ email: email.trim().toLowerCase() }).lean();
  if (exists) { res.status(409); throw new Error('Email already in use'); }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await VendorUser.create({ name: String(name).trim(), email: String(email).trim().toLowerCase(), passwordHash, vendor, permissions: Array.isArray(permissions) ? permissions : [] });
  res.status(201).json({ success: true, data: created });
});

// Update vendor user (admin-only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, password, vendor, permissions, isActive } = req.body || {};
  const user = await VendorUser.findById(id);
  if (!user) { res.status(404); throw new Error('vendor user not found'); }
  if (name !== undefined) user.name = String(name).trim();
  if (email !== undefined) {
    if (!isValidEmail(email)) { res.status(400); throw new Error('Invalid email format'); }
    user.email = String(email).trim().toLowerCase();
  }
  if (password !== undefined) {
    if (String(password).length < 8) { res.status(400); throw new Error('Password must be at least 8 characters'); }
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  if (vendor !== undefined) {
    const v = await Vendor.findById(vendor).lean();
    if (!v) { res.status(400); throw new Error('Vendor not found'); }
    user.vendor = vendor;
  }
  if (permissions !== undefined) user.permissions = Array.isArray(permissions) ? permissions : [];
  if (isActive !== undefined) user.isActive = Boolean(isActive);

  const updated = await user.save();
  res.json({ success: true, data: updated });
});

// Delete vendor user (admin-only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await VendorUser.findByIdAndDelete(id).lean();
  if (!deleted) { res.status(404); throw new Error('vendor user not found'); }
  res.json({ success: true });
});

module.exports = router;