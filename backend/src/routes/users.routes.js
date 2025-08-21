const express = require('express');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const isValidEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Admin: create a basic customer (optional; public customers use /auth/register)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, isActive } = req.body || {};

  if (!name || !email) {
    res.status(400);
    throw new Error('Both name and email are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const exists = await User.findOne({ email: String(email).toLowerCase() }).lean();
  if (exists) {
    res.status(409);
    throw new Error('Email already in use');
  }

  const user = await User.create({ name: String(name).trim(), email: String(email).trim().toLowerCase(), isActive: isActive !== undefined ? Boolean(isActive) : true });
  res.status(201).json({ success: true, data: user });
});

// Admin: list customers with search, status filter, pagination
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { q = '', status = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  if (q) {
    const regex = new RegExp(String(q), 'i');
    filters.$or = [
      { name: { $regex: regex } },
      { email: { $regex: regex } }
    ];
  }
  if (status === 'active') filters.isActive = true;
  if (status === 'inactive') filters.isActive = false;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    User.find(filters).sort({ createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    User.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// Admin: update customer status (activate/deactivate)
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body || {};
  if (isActive === undefined) {
    res.status(400);
    throw new Error('isActive is required');
  }
  const updated = await User.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ success: true, data: updated });
});

module.exports = router;