const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const VendorUser = require('../models/VendorUser');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  if (process.env.NODE_ENV !== 'production' && secret === 'dev-secret') {
    console.warn('Warning: Using default JWT secret. Set JWT_SECRET in environment for production.');
  }
  return secret;
}

function getJwtExpiry() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Try Admin login first
  const admin = await Admin.findOne({ email: normalizedEmail, $or: [{ isActive: true }, { isActive: { $exists: false } }] });
  if (admin) {
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) { res.status(401); throw new Error('Invalid credentials'); }
    const token = jwt.sign(
      { id: admin._id.toString(), role: 'admin', email: admin.email },
      getJwtSecret(),
      { expiresIn: getJwtExpiry() }
    );
    return res.json({ success: true, token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } });
  }

  // Try Vendor User login
  const vendorUser = await VendorUser.findOne({ email: normalizedEmail, isActive: true }).populate('vendor', '_id companyName enabled status').lean();
  if (!vendorUser) { res.status(401); throw new Error('Invalid credentials'); }
  const vendorUserDoc = await VendorUser.findOne({ email: normalizedEmail, isActive: true });
  const ok = await bcrypt.compare(password, vendorUserDoc.passwordHash);
  if (!ok) { res.status(401); throw new Error('Invalid credentials'); }

  // Ensure vendor is enabled/approved
  const vendor = await Vendor.findById(vendorUserDoc.vendor).lean();
  if (!vendor || vendor.enabled === false || vendor.status !== 'approved') {
    res.status(403);
    throw new Error('Vendor is not approved or is disabled');
  }

  const token = jwt.sign(
    { id: vendorUserDoc._id.toString(), role: 'vendor', email: vendorUserDoc.email, vendorId: vendor._id.toString(), permissions: vendorUserDoc.permissions || [] },
    getJwtSecret(),
    { expiresIn: getJwtExpiry() }
  );

  return res.json({ success: true, token, user: { id: vendorUserDoc._id, name: vendorUserDoc.name, email: vendorUserDoc.email, role: 'vendor', vendorId: vendor._id } });
});

router.get('/me', authenticate, requireAdmin, async (req, res) => {
  const admin = await Admin.findById(req.user.id).lean();
  if (!admin || admin.isActive === false) {
    res.status(401);
    throw new Error('Admin not found or inactive');
  }
  res.json({
    success: true,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });
});

module.exports = router;