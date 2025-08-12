const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Create a new admin (admin-only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password, isActive } = req.body || {};

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email and password are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }
  if (String(password).length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const exists = await Admin.findOne({ email: normalizedEmail });
  if (exists) {
    res.status(409);
    throw new Error('Email already in use');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await Admin.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    isActive: isActive === false ? false : true,
    role: 'admin'
  });

  // Upsert a linked basic user record
  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    { $setOnInsert: { name: String(name).trim(), email: normalizedEmail } },
    { new: true, upsert: true }
  );

  res.status(201).json({
    success: true,
    data: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      userLinkId: user?._id || null
    }
  });
});

module.exports = router;