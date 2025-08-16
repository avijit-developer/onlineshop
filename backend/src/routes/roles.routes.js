const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const Role = require('../models/Role');

const router = express.Router();

// List roles
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { q = '' } = req.query;
  const filters = {};
  if (q) filters.name = { $regex: String(q), $options: 'i' };
  const items = await Role.find(filters).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: items });
});

// Create role
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, description = '', permissions = [] } = req.body || {};
  if (!name) { res.status(400); throw new Error('name is required'); }
  const created = await Role.create({ name: String(name).trim(), description: String(description).trim(), permissions: Array.isArray(permissions) ? permissions : [] });
  res.status(201).json({ success: true, data: created });
});

// Update role
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions, isActive } = req.body || {};
  const role = await Role.findById(id);
  if (!role) { res.status(404); throw new Error('role not found'); }
  if (name !== undefined) role.name = String(name).trim();
  if (description !== undefined) role.description = String(description).trim();
  if (permissions !== undefined) role.permissions = Array.isArray(permissions) ? permissions : [];
  if (isActive !== undefined) role.isActive = Boolean(isActive);
  const updated = await role.save();
  res.json({ success: true, data: updated });
});

// Delete role
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await Role.findByIdAndDelete(id).lean();
  res.json({ success: true });
});

module.exports = router;