const express = require('express');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');
const Banner = require('../models/Banner');

const router = express.Router();

// List banners with filters and pagination (admin/vendor)
router.get('/', authenticate, requireRole(['admin','vendor']), async (req, res) => {
  const { q = '', status = 'all', page = 1, limit = 10 } = req.query;
  const filters = {};
  if (q) {
    filters.$or = [
      { title: { $regex: String(q), $options: 'i' } },
      { description: { $regex: String(q), $options: 'i' } }
    ];
  }
  if (status !== 'all') {
    if (status === 'active') filters.isActive = true; else if (status === 'inactive') filters.isActive = false;
  }
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const [items, total] = await Promise.all([
    Banner.find(filters).sort({ position: 1, createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    Banner.countDocuments(filters)
  ]);
  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// Public banners: active and within date range
router.get('/public', async (req, res) => {
  const now = new Date();
  const filters = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  };
  const items = await Banner.find(filters)
    .sort({ position: 1, createdAt: -1 })
    .select({
      title: 1,
      description: 1,
      image: 1,
      linkUrl: 1,
      linkText: 1,
      position: 1
    })
    .lean();
  res.json({ success: true, data: items });
});

// Create banner (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { title, description = '', imageUrl, imagePublicId = '', linkUrl = '', linkText = '', position = 1, startDate, endDate, isActive = true, targetType = 'none', targetId = '' } = req.body || {};
  if (!title) { res.status(400); throw new Error('title is required'); }
  if (!imageUrl) { res.status(400); throw new Error('imageUrl is required'); }
  if (!startDate || !endDate) { res.status(400); throw new Error('startDate and endDate are required'); }
  const created = await Banner.create({
    title: String(title).trim(),
    description: String(description).trim(),
    image: String(imageUrl).trim(),
    imagePublicId: String(imagePublicId).trim(),
    linkUrl: String(linkUrl).trim(),
    linkText: String(linkText).trim(),
    position: Number(position) || 1,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    isActive: Boolean(isActive),
    targetType: targetType || 'none',
    targetId: String(targetId).trim()
  });
  res.status(201).json({ success: true, data: created });
});

// Update banner (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const b = await Banner.findById(id);
  if (!b) { res.status(404); throw new Error('banner not found'); }
  const { title, description, imageUrl, imagePublicId, linkUrl, linkText, position, startDate, endDate, isActive, targetType, targetId } = req.body || {};
  if (title !== undefined) b.title = String(title).trim();
  if (description !== undefined) b.description = String(description).trim();
  if (imageUrl !== undefined) b.image = String(imageUrl).trim();
  if (imagePublicId !== undefined) b.imagePublicId = String(imagePublicId).trim();
  if (linkUrl !== undefined) b.linkUrl = String(linkUrl).trim();
  if (linkText !== undefined) b.linkText = String(linkText).trim();
  if (position !== undefined) b.position = Number(position) || 1;
  if (startDate !== undefined) b.startDate = new Date(startDate);
  if (endDate !== undefined) b.endDate = new Date(endDate);
  if (isActive !== undefined) b.isActive = Boolean(isActive);
  if (targetType !== undefined) b.targetType = targetType;
  if (targetId !== undefined) b.targetId = String(targetId).trim();
  const updated = await b.save();
  res.json({ success: true, data: updated });
});

// Delete banner (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await Banner.findByIdAndDelete(id).lean();
  res.json({ success: true });
});

module.exports = router;

