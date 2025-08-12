const express = require('express');
const Category = require('../models/Category');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// List categories with optional parent filter and pagination
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { parent = 'root', q = '', page = 1, limit = 50 } = req.query;
  const filters = {};
  if (parent === 'root') {
    filters.parent = null;
  } else if (parent === 'all') {
    // no parent filter
  } else if (parent) {
    filters.parent = parent;
  }
  if (q) {
    filters.name = { $regex: String(q), $options: 'i' };
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

  const [items, total] = await Promise.all([
    Category.find(filters)
      .sort({ sortOrder: 1, name: 1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Category.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// Create a category
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, description, parent, image, featured = false, sortOrder = 0 } = req.body || {};
  if (!name) {
    res.status(400);
    throw new Error('name is required');
  }

  // Validate parent exists if provided
  let parentId = null;
  if (parent) {
    const parentDoc = await Category.findById(parent).lean();
    if (!parentDoc) {
      res.status(400);
      throw new Error('parent not found');
    }
    parentId = parentDoc._id;
  }

  const created = await Category.create({
    name: String(name).trim(),
    description: description ? String(description).trim() : '',
    parent: parentId,
    image: image || '',
    featured: Boolean(featured),
    sortOrder: Number(sortOrder) || 0
  });

  res.status(201).json({ success: true, data: created });
});

// Update a category
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, parent, image, featured, sortOrder } = req.body || {};

  // Prevent setting parent to itself
  if (parent && parent === id) {
    res.status(400);
    throw new Error('parent cannot be self');
  }

  // Validate parent exists if provided
  let parentId = undefined;
  if (parent !== undefined) {
    if (parent === null || parent === '') {
      parentId = null;
    } else {
      const parentDoc = await Category.findById(parent).lean();
      if (!parentDoc) {
        res.status(400);
        throw new Error('parent not found');
      }
      parentId = parentDoc._id;
    }
  }

  const updated = await Category.findByIdAndUpdate(
    id,
    {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: String(description).trim() } : {}),
      ...(parentId !== undefined ? { parent: parentId } : {}),
      ...(image !== undefined ? { image } : {}),
      ...(featured !== undefined ? { featured: Boolean(featured) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) || 0 } : {})
    },
    { new: true }
  );

  if (!updated) {
    res.status(404);
    throw new Error('category not found');
  }

  res.json({ success: true, data: updated });
});

// Delete a category (only if no children)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const child = await Category.findOne({ parent: id }).lean();
  if (child) {
    res.status(400);
    throw new Error('Cannot delete category with subcategories');
  }
  const deleted = await Category.findByIdAndDelete(id).lean();
  if (!deleted) {
    res.status(404);
    throw new Error('category not found');
  }
  res.json({ success: true });
});

module.exports = router;