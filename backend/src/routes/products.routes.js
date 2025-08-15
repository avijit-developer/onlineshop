const express = require('express');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadImageBuffer, deleteImageByPublicId } = require('../config/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 } });

// GET /products?q=&status=&category=&brand=&vendor=&page=&limit=
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { q = '', status = 'all', category, brand, vendor, page = 1, limit = 10 } = req.query;
  const filters = {};
  if (q) {
    filters.$or = [
      { name: { $regex: String(q), $options: 'i' } },
      { sku: { $regex: String(q), $options: 'i' } },
      { description: { $regex: String(q), $options: 'i' } }
    ];
  }
  if (status !== 'all') filters.status = status;
  if (category) filters.category = category;
  if (brand) filters.brand = brand;
  if (vendor) filters.vendor = vendor;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    Product.find(filters)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Product.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// POST /products (JSON only, images handled via direct uploads)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const required = ['name', 'category', 'vendor', 'regularPrice'];
  for (const f of required) {
    if (!body[f]) {
      res.status(400);
      throw new Error(`${f} is required`);
    }
  }

  // Validate variant requirements if variants present
  if (Array.isArray(body.variants)) {
    for (const v of body.variants) {
      if (!v || !v.sku || v.price === undefined || v.price === null) {
        res.status(400);
        throw new Error('Each variant must have sku and price');
      }
    }
  }

  // Validate refs
  const [c, v, b] = await Promise.all([
    Category.findById(body.category).lean(),
    Vendor.findById(body.vendor).lean(),
    body.brand ? Brand.findById(body.brand).lean() : Promise.resolve(true)
  ]);
  if (!c || !v || !b) {
    res.status(400);
    throw new Error('Invalid category, vendor or brand');
  }

  // Uniqueness checks
  if (body.sku) {
    const existsSku = await Product.findOne({ sku: String(body.sku).trim() }).select({ _id: 1 }).lean();
    if (existsSku) {
      res.status(409);
      throw new Error('Product SKU already exists');
    }
  }
  if (Array.isArray(body.variants)) {
    const variantSkus = body.variants.map(v => (v?.sku || '').trim()).filter(Boolean);
    if (variantSkus.length) {
      const dupInPayload = new Set();
      const seen = new Set();
      for (const s of variantSkus) { if (seen.has(s)) dupInPayload.add(s); seen.add(s); }
      if (dupInPayload.size) {
        res.status(409);
        throw new Error(`Duplicate variant SKU(s): ${Array.from(dupInPayload).join(', ')}`);
      }
      const existsVariant = await Product.findOne({ 'variants.sku': { $in: variantSkus } }).select({ _id: 1 }).lean();
      if (existsVariant) {
        res.status(409);
        throw new Error('One or more variant SKUs already exist');
      }
    }
  }

  const created = await Product.create({
    name: String(body.name).trim(),
    description: body.description ? String(body.description).trim() : '',
    category: body.category,
    brand: body.brand || undefined,
    vendor: body.vendor,
    sku: body.sku ? String(body.sku).trim() : undefined,
    tags: Array.isArray(body.tags) ? body.tags : [],
    regularPrice: Number(body.regularPrice),
    specialPrice: body.specialPrice !== undefined ? Number(body.specialPrice) : undefined,
    tax: body.tax !== undefined ? Number(body.tax) : undefined,
    stock: body.stock !== undefined ? Number(body.stock) : undefined,
    images: Array.isArray(body.images) ? body.images : [],
    imagePublicIds: Array.isArray(body.imagePublicIds) ? body.imagePublicIds : [],
    variants: Array.isArray(body.variants)
      ? body.variants.map(v => ({
          attributes: v.attributes || {},
          sku: v.sku ? String(v.sku).trim() : undefined,
          price: v.price !== undefined ? Number(v.price) : undefined,
          specialPrice: v.specialPrice !== undefined ? Number(v.specialPrice) : undefined,
          stock: v.stock !== undefined ? Number(v.stock) : 0,
          images: Array.isArray(v.images) ? v.images : []
        }))
      : [],
    status: body.status || 'pending',
    featured: Boolean(body.featured),
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : true
  });

  res.status(201).json({ success: true, data: created });
});

// PUT /products/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const product = await Product.findById(id);
  if (!product) {
    res.status(404);
    throw new Error('product not found');
  }

  if (body.name !== undefined) product.name = String(body.name).trim();
  if (body.description !== undefined) product.description = String(body.description).trim();
  if (body.category !== undefined) {
    const c = await Category.findById(body.category).lean();
    if (!c) { res.status(400); throw new Error('invalid category'); }
    product.category = body.category;
  }
  if (body.brand !== undefined) {
    if (body.brand) {
      const b = await Brand.findById(body.brand).lean();
      if (!b) { res.status(400); throw new Error('invalid brand'); }
      product.brand = body.brand;
    } else {
      product.brand = undefined;
    }
  }
  if (body.vendor !== undefined) {
    const v = await Vendor.findById(body.vendor).lean();
    if (!v) { res.status(400); throw new Error('invalid vendor'); }
    product.vendor = body.vendor;
  }

  if (body.sku !== undefined) {
    const newSku = String(body.sku).trim();
    const existsSku = await Product.findOne({ _id: { $ne: id }, sku: newSku }).select({ _id: 1 }).lean();
    if (existsSku) { res.status(409); throw new Error('Product SKU already exists'); }
    product.sku = newSku;
  }
  if (body.tags !== undefined) product.tags = Array.isArray(body.tags) ? body.tags : [];

  if (body.regularPrice !== undefined) product.regularPrice = Number(body.regularPrice);
  if (body.specialPrice !== undefined) product.specialPrice = Number(body.specialPrice);
  if (body.tax !== undefined) product.tax = Number(body.tax);
  if (body.stock !== undefined) product.stock = Number(body.stock);

  if (body.images !== undefined) product.images = Array.isArray(body.images) ? body.images : [];
  if (body.imagePublicIds !== undefined) product.imagePublicIds = Array.isArray(body.imagePublicIds) ? body.imagePublicIds : [];
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants)) { res.status(400); throw new Error('variants must be an array'); }
    const variantSkus = body.variants.map(v => (v?.sku || '').trim()).filter(Boolean);
    if (variantSkus.length) {
      const dupInPayload = new Set();
      const seen = new Set();
      for (const s of variantSkus) { if (seen.has(s)) dupInPayload.add(s); seen.add(s); }
      if (dupInPayload.size) { res.status(409); throw new Error(`Duplicate variant SKU(s): ${Array.from(dupInPayload).join(', ')}`); }
      const existsVariant = await Product.findOne({ _id: { $ne: id }, 'variants.sku': { $in: variantSkus } }).select({ _id: 1 }).lean();
      if (existsVariant) { res.status(409); throw new Error('One or more variant SKUs already exist'); }
    }
    product.variants = body.variants.map(v => ({
      attributes: v.attributes || {},
      sku: v.sku ? String(v.sku).trim() : undefined,
      price: v.price !== undefined ? Number(v.price) : undefined,
      specialPrice: v.specialPrice !== undefined ? Number(v.specialPrice) : undefined,
      stock: v.stock !== undefined ? Number(v.stock) : 0,
      images: Array.isArray(v.images) ? v.images : []
    }));
  }

  if (body.status !== undefined) product.status = body.status;
  if (body.featured !== undefined) product.featured = Boolean(body.featured);
  if (body.enabled !== undefined) product.enabled = Boolean(body.enabled);

  const updated = await product.save();
  res.json({ success: true, data: updated });
});

// DELETE /products/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await Product.findByIdAndDelete(id).lean();
  if (!deleted) {
    res.status(404);
    throw new Error('product not found');
  }
  // Note: consider deleting Cloudinary images if imagePublicIds exist
  res.json({ success: true });
});

// PATCH /products/:id/enabled
router.patch('/:id/enabled', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body || {};
  const updated = await Product.findByIdAndUpdate(id, { enabled: Boolean(enabled) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('product not found');
  }
  res.json({ success: true, data: updated });
});

module.exports = router;