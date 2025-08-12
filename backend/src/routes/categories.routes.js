const express = require('express');
const multer = require('multer');
const Category = require('../models/Category');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadImageBuffer, deleteImageByPublicId } = require('../config/cloudinary');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      const err = new Error('Only image files (jpg, png, webp, gif) are allowed');
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err);
    }
    cb(null, true);
  }
});

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
router.post('/', authenticate, requireAdmin, upload.single('imageFile'), async (req, res) => {
  const { name, description, parent, featured = 'false', sortOrder = '0' } = req.body || {};
  if (!name) {
    res.status(400);
    throw new Error('name is required');
  }

  let parentId = null;
  if (parent) {
    const parentDoc = await Category.findById(parent).lean();
    if (!parentDoc) {
      res.status(400);
      throw new Error('parent not found');
    }
    parentId = parentDoc._id;
  }

  // If direct upload was used, accept imageUrl + imagePublicId instead of file
  const imageUrl = req.body.imageUrl;
  const imagePublicId = req.body.imagePublicId;
  if (!req.file || !req.file.buffer) {
    if (!imageUrl || !imagePublicId) {
      res.status(400);
      throw new Error('image is required');
    }
  }

  // Check duplicate sortOrder under same parent
  const existingRank = await Category.findOne({ parent: parentId, sortOrder: Number(sortOrder) || 0 }).lean();
  if (existingRank) {
    res.status(409);
    throw new Error('Sort Order already used for this parent. Please choose a different rank.');
  }

  let uploaded = null;
  if (req.file && req.file.buffer) {
    try {
      uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, 'categories');
    } catch (e) {
      res.status(502);
      throw new Error(`Cloudinary upload failed: ${e?.message || e}`);
    }
  }

  try {
    const created = await Category.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      parent: parentId,
      image: (uploaded?.url || imageUrl || ''),
      featured: String(featured) === 'true' || featured === true,
      sortOrder: Number(sortOrder) || 0,
      imagePublicId: (uploaded?.publicId || imagePublicId || undefined)
    });
    return res.status(201).json({ success: true, data: created });
  } catch (e) {
    if (e && e.code === 11000) {
      res.status(409);
      throw new Error('Sort Order already used for this parent. Please choose a different rank.');
    }
    throw e;
  }
});

// Update a category
router.put('/:id', authenticate, requireAdmin, upload.single('imageFile'), async (req, res) => {
  const { id } = req.params;
  const { name, description, parent, featured, sortOrder } = req.body || {};

  if (parent && parent === id) {
    res.status(400);
    throw new Error('parent cannot be self');
  }

  let parentId = undefined;
  if (parent !== undefined) {
    if (parent === null || parent === '' || parent === 'null') {
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

  let uploaded = null;
  const imageUrl = req.body.imageUrl;
  const imagePublicId = req.body.imagePublicId;
  if (req.file && req.file.buffer) {
    try {
      uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, 'categories');
    } catch (e) {
      res.status(502);
      throw new Error(`Cloudinary upload failed: ${e?.message || e}`);
    }
  }

  const existing = await Category.findById(id);
  if (!existing) {
    res.status(404);
    throw new Error('category not found');
  }

  if (uploaded?.publicId && existing.imagePublicId) {
    deleteImageByPublicId(existing.imagePublicId).catch(() => {});
  }

  existing.name = name !== undefined ? String(name).trim() : existing.name;
  existing.description = description !== undefined ? String(description).trim() : existing.description;
  if (parentId !== undefined) existing.parent = parentId;
  if (uploaded?.url) existing.image = uploaded.url;
  if (uploaded?.publicId) existing.imagePublicId = uploaded.publicId;
  if (!uploaded && imageUrl) existing.image = imageUrl;
  if (!uploaded && imagePublicId) existing.imagePublicId = imagePublicId;
  if (featured !== undefined) existing.featured = String(featured) === 'true' || featured === true;
  if (sortOrder !== undefined) existing.sortOrder = Number(sortOrder) || 0;

  try {
    const updated = await existing.save();
    return res.json({ success: true, data: updated });
  } catch (e) {
    if (e && e.code === 11000) {
      res.status(409);
      throw new Error('Sort Order already used for this parent. Please choose a different rank.');
    }
    throw e;
  }
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
  if (deleted.imagePublicId) {
    deleteImageByPublicId(deleted.imagePublicId).catch(() => {});
  }
  res.json({ success: true });
});

module.exports = router;