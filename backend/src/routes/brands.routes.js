const express = require('express');
const multer = require('multer');
const Brand = require('../models/Brand');
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

// GET /brands?q=&page=&limit=&featured=
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { q = '', page = 1, limit = 10, featured } = req.query;
  const filters = {};
  if (q) {
    filters.name = { $regex: String(q), $options: 'i' };
  }
  if (featured === 'true') filters.featured = true;
  if (featured === 'false') filters.featured = false;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    Brand.find(filters)
      .sort({ sortOrder: 1, name: 1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Brand.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// POST /brands (accepts imageUrl/imagePublicId OR file upload as logoFile)
router.post('/', authenticate, requireAdmin, upload.single('logoFile'), async (req, res) => {
  const { name, description = '', website = '', categories = '[]', featured = 'false', sortOrder = '0' } = req.body || {};
  if (!name) {
    res.status(400);
    throw new Error('name is required');
  }

  // categories can be JSON array of ids
  let categoryIds = [];
  try {
    const parsed = typeof categories === 'string' ? JSON.parse(categories) : categories;
    if (Array.isArray(parsed)) categoryIds = parsed.filter(Boolean);
  } catch (e) {
    res.status(400);
    throw new Error('categories must be a JSON array');
  }

  // Validate category ids if provided
  if (categoryIds.length) {
    const found = await Category.find({ _id: { $in: categoryIds } }, { _id: 1 }).lean();
    if (found.length !== categoryIds.length) {
      res.status(400);
      throw new Error('One or more categories not found');
    }
  }

  // Support direct upload fields
  const imageUrl = req.body.imageUrl;
  const imagePublicId = req.body.imagePublicId;

  let uploaded = null;
  if (req.file && req.file.buffer) {
    try {
      uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, 'brands');
    } catch (e) {
      res.status(502);
      throw new Error(`Cloudinary upload failed: ${e?.message || e}`);
    }
  }

  const created = await Brand.create({
    name: String(name).trim(),
    description: String(description).trim(),
    website: String(website).trim(),
    categories: categoryIds,
    featured: String(featured) === 'true' || featured === true,
    sortOrder: Number(sortOrder) || 0,
    logo: uploaded?.url || imageUrl || '',
    logoPublicId: uploaded?.publicId || imagePublicId || ''
  });

  res.status(201).json({ success: true, data: created });
});

// PUT /brands/:id (accept direct upload or file)
router.put('/:id', authenticate, requireAdmin, upload.single('logoFile'), async (req, res) => {
  const { id } = req.params;
  const brand = await Brand.findById(id);
  if (!brand) {
    res.status(404);
    throw new Error('brand not found');
  }

  const { name, description, website, categories, featured, sortOrder } = req.body || {};

  // Parse categories if provided
  let categoryIds;
  if (categories !== undefined) {
    try {
      const parsed = typeof categories === 'string' ? JSON.parse(categories) : categories;
      if (!Array.isArray(parsed)) throw new Error('categories must be array');
      categoryIds = parsed.filter(Boolean);
      if (categoryIds.length) {
        const found = await Category.find({ _id: { $in: categoryIds } }, { _id: 1 }).lean();
        if (found.length !== categoryIds.length) {
          res.status(400);
          throw new Error('One or more categories not found');
        }
      }
    } catch (e) {
      res.status(400);
      throw new Error('categories must be a JSON array');
    }
  }

  let uploaded = null;
  const imageUrl = req.body.imageUrl;
  const imagePublicId = req.body.imagePublicId;
  if (req.file && req.file.buffer) {
    try {
      uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, 'brands');
    } catch (e) {
      res.status(502);
      throw new Error(`Cloudinary upload failed: ${e?.message || e}`);
    }
  }

  if (uploaded?.publicId && brand.logoPublicId) {
    deleteImageByPublicId(brand.logoPublicId).catch(() => {});
  }

  if (name !== undefined) brand.name = String(name).trim();
  if (description !== undefined) brand.description = String(description).trim();
  if (website !== undefined) brand.website = String(website).trim();
  if (categoryIds !== undefined) brand.categories = categoryIds;
  if (featured !== undefined) brand.featured = String(featured) === 'true' || featured === true;
  if (sortOrder !== undefined) brand.sortOrder = Number(sortOrder) || 0;
  if (uploaded?.url) brand.logo = uploaded.url;
  if (uploaded?.publicId) brand.logoPublicId = uploaded.publicId;
  if (!uploaded && imageUrl !== undefined) brand.logo = imageUrl;
  if (!uploaded && imagePublicId !== undefined) brand.logoPublicId = imagePublicId;

  const updated = await brand.save();
  res.json({ success: true, data: updated });
});

// PATCH /brands/:id/feature
router.patch('/:id/feature', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { featured } = req.body || {};
  const updated = await Brand.findByIdAndUpdate(id, { featured: Boolean(featured) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('brand not found');
  }
  res.json({ success: true, data: updated });
});

// DELETE /brands/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await Brand.findByIdAndDelete(id).lean();
  if (!deleted) {
    res.status(404);
    throw new Error('brand not found');
  }
  if (deleted.logoPublicId) {
    deleteImageByPublicId(deleted.logoPublicId).catch(() => {});
  }
  res.json({ success: true });
});

module.exports = router;