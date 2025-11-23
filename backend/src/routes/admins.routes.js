const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// List admins
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { q = '', page = 1, limit = 20 } = req.query;
  const filters = {};
  if (q) {
    filters.$or = [
      { name: { $regex: String(q), $options: 'i' } },
      { email: { $regex: String(q), $options: 'i' } }
    ];
  }
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const [items, total] = await Promise.all([
    Admin.find(filters).sort({ createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    Admin.countDocuments(filters)
  ]);
  res.json({ success: true, data: items.map(a => ({ id: a._id, name: a.name, email: a.email, phone: a.phone, role: a.role, isActive: a.isActive, createdAt: a.createdAt })), meta: { total, page: pageNum, limit: perPage } });
});

// Create a new admin (admin-only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, phone, password, isActive } = req.body || {};

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
    phone: phone ? String(phone).trim() : undefined,
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
      phone: admin.phone,
      role: admin.role,
      isActive: admin.isActive,
      userLinkId: user?._id || null
    }
  });
});

// Update admin
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, password, isActive } = req.body || {};
  const admin = await Admin.findById(id);
  if (!admin) { res.status(404); throw new Error('admin not found'); }
  if (name !== undefined) admin.name = String(name).trim();
  if (email !== undefined) {
    if (!isValidEmail(email)) { res.status(400); throw new Error('Invalid email format'); }
    admin.email = String(email).trim().toLowerCase();
  }
  if (phone !== undefined) admin.phone = phone ? String(phone).trim() : undefined;
  if (password !== undefined) {
    if (String(password).length < 8) { res.status(400); throw new Error('Password must be at least 8 characters'); }
    admin.passwordHash = await bcrypt.hash(password, 10);
  }
  if (isActive !== undefined) admin.isActive = Boolean(isActive);
  const updated = await admin.save();
  res.json({ success: true, data: { id: updated._id, name: updated.name, email: updated.email, phone: updated.phone, role: updated.role, isActive: updated.isActive, createdAt: updated.createdAt } });
});

// Delete admin
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  // Prevent admin from deleting themselves
  if (req.user.id === id) {
    res.status(403);
    throw new Error('You cannot delete your own account');
  }
  const deleted = await Admin.findByIdAndDelete(id).lean();
  if (!deleted) { res.status(404); throw new Error('admin not found'); }
  res.json({ success: true });
});

module.exports = router;