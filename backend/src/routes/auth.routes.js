const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
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

  const admin = await Admin.findOne({ email: normalizedEmail, $or: [{ isActive: true }, { isActive: { $exists: false } }] });
  if (!admin) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { id: admin._id.toString(), role: 'admin', email: admin.email },
    getJwtSecret(),
    { expiresIn: getJwtExpiry() }
  );

  res.json({
    success: true,
    token,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });
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