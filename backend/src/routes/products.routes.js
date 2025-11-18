const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin, requireRole, requirePermission, requireAnyPermission } = require('../middleware/auth');
const { uploadImageBuffer, deleteImageByPublicId } = require('../config/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 } });

// Helpers: SKU generation
function buildSkuBaseFromName(name) {
  try {
    return String(name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
  } catch (_) {
    return 'PROD';
  }
}

async function generateUniqueProductSku(name) {
  const base = buildSkuBaseFromName(name || 'PROD');
  let candidate = base || 'PROD';
  let i = 0;
  // Ensure uniqueness against existing products
  // Try base, then base-001 ... base-9999
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Product.findOne({ sku: candidate }).select({ _id: 1 }).lean();
    if (!exists) return candidate;
    i += 1;
    const suffix = String(i).padStart(3, '0');
    candidate = `${base}-${suffix}`.slice(0, 36);
  }
}

async function generateUniqueVariantSku(productName, existingSkusInPayload = new Set()) {
  const base = buildSkuBaseFromName(productName || 'PROD');
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base}-V${String(i).padStart(2, '0')}`.slice(0, 36);
    if (!existingSkusInPayload.has(candidate)) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Product.findOne({ 'variants.sku': candidate }).select({ _id: 1 }).lean();
      if (!exists) return candidate;
    }
    i += 1;
  }
}

// GET /products?q=&status=&category=&brand=&vendor=&page=&limit=
router.get('/', authenticate, requireRole(['admin','vendor']), requirePermission('products.view'), async (req, res) => {
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
  if (category && category !== 'all') filters.category = category;
  if (brand && brand !== 'all') filters.brand = brand;
  if (req.user.role === 'vendor') {
    filters.vendor = req.user.vendorId;
  } else if (vendor && vendor !== 'all') {
    filters.vendor = vendor;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    Product.find(filters)
      .select('-vendorSpecialPrice -variants.vendorSpecialPrice')
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('vendor', 'companyName')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Product.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// POST /products (JSON only, images handled via direct uploads)
router.post('/', authenticate, requireRole(['admin','vendor']), requirePermission('products.add'), async (req, res) => {
  const body = req.body || {};
  // Require different fields based on role: vendor provides vendorRegularPrice, admin provides regularPrice
  const isVendorUser = req.user.role === 'vendor';
  const required = isVendorUser ? ['name', 'category', 'vendor', 'vendorRegularPrice'] : ['name', 'category', 'vendor', 'regularPrice'];
  for (const f of required) {
    if (!body[f]) {
      res.status(400);
      throw new Error(`${f} is required`);
    }
  }

  // Validate variant requirements if variants present
  if (Array.isArray(body.variants)) {
    for (const v of body.variants) {
      const priceField = isVendorUser ? (v.vendorPrice ?? v.price) : v.price;
      if (priceField === undefined || priceField === null) {
        res.status(400);
        throw new Error('Each variant must have price');
      }
    }
  }

  // Enforce vendor scoping
  if (req.user.role === 'vendor') {
    body.vendor = req.user.vendorId;
  }

  // Autogenerate product SKU if missing
  if (!body.sku) {
    body.sku = await generateUniqueProductSku(body.name);
  } else {
    body.sku = String(body.sku).trim().toUpperCase();
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

  // Uniqueness checks for provided product SKU
  if (body.sku) {
    const existsSku = await Product.findOne({ sku: String(body.sku).trim() }).select({ _id: 1 }).lean();
    if (existsSku) {
      // If collision, autogenerate a new one from name
      body.sku = await generateUniqueProductSku(body.name);
    }
  }
  if (Array.isArray(body.variants)) {
    // Autogenerate missing variant SKUs; ensure uniqueness across payload and DB
    const payloadSkuSet = new Set();
    for (let idx = 0; idx < body.variants.length; idx++) {
      const vv = body.variants[idx] || {};
      const rawSku = vv.sku ? String(vv.sku).trim().toUpperCase() : '';
      let nextSku = rawSku;
      if (!nextSku) {
        // eslint-disable-next-line no-await-in-loop
        nextSku = await generateUniqueVariantSku(body.name, payloadSkuSet);
      } else {
        // Ensure provided SKU does not collide within payload or DB
        if (payloadSkuSet.has(nextSku)) {
          // eslint-disable-next-line no-await-in-loop
          nextSku = await generateUniqueVariantSku(body.name, payloadSkuSet);
        } else {
          // eslint-disable-next-line no-await-in-loop
          const exists = await Product.findOne({ 'variants.sku': nextSku }).select({ _id: 1 }).lean();
          if (exists) {
            // eslint-disable-next-line no-await-in-loop
            nextSku = await generateUniqueVariantSku(body.name, payloadSkuSet);
          }
        }
      }
      payloadSkuSet.add(nextSku);
      body.variants[idx].sku = nextSku;
    }
    const variantSkus = body.variants.map(v => (v?.sku || '').trim()).filter(Boolean);
    if (variantSkus.length) {
      const dupInPayload = new Set();
      const seen = new Set();
      for (const s of variantSkus) { if (seen.has(s)) dupInPayload.add(s); seen.add(s); }
      if (dupInPayload.size) {
        res.status(409);
        throw new Error(`Duplicate variant SKU(s): ${Array.from(dupInPayload).join(', ')}`);
      }
      // Global uniqueness also guarded by DB index
    }
  }

  // Determine product type based on variants
  const hasVariants = Array.isArray(body.variants) && body.variants.length > 0;
  const productType = hasVariants ? 'configurable' : 'simple';
  
  console.log(`Creating product "${body.name}" with type: ${productType} (variants: ${hasVariants ? body.variants.length : 0})`);

  const created = await Product.create({
    name: String(body.name).trim(),
    description: body.description ? String(body.description).trim() : '',
    shortDescription: body.shortDescription ? String(body.shortDescription).trim() : undefined,
    category: body.category,
    brand: body.brand || undefined,
    vendor: body.vendor,
    sku: body.sku ? String(body.sku).trim() : undefined,
    tags: Array.isArray(body.tags) ? body.tags : [],
    // Admin and Vendor pricing captured separately
    regularPrice: !isVendorUser && body.regularPrice !== undefined ? Number(body.regularPrice) : undefined,
    specialPrice: !isVendorUser && body.specialPrice !== undefined ? Number(body.specialPrice) : undefined,
    vendorRegularPrice: isVendorUser && (body.vendorRegularPrice !== undefined ? Number(body.vendorRegularPrice) : (body.regularPrice !== undefined ? Number(body.regularPrice) : undefined)),
    tax: body.tax !== undefined ? Number(body.tax) : undefined,
    stock: body.stock !== undefined ? Number(body.stock) : undefined,
    images: Array.isArray(body.images) ? body.images : [],
    imagePublicIds: Array.isArray(body.imagePublicIds) ? body.imagePublicIds : [],
    videoUrl: body.videoUrl ? String(body.videoUrl).trim() : '',
    videoPublicId: body.videoPublicId ? String(body.videoPublicId).trim() : '',
    variants: hasVariants
      ? body.variants.map(v => ({
          attributes: v.attributes || {},
          sku: v.sku ? String(v.sku).trim() : undefined,
          price: !isVendorUser && v.price !== undefined ? Number(v.price) : undefined,
          specialPrice: !isVendorUser && v.specialPrice !== undefined ? Number(v.specialPrice) : undefined,
          vendorPrice: isVendorUser && (v.vendorPrice !== undefined ? Number(v.vendorPrice) : (v.price !== undefined ? Number(v.price) : undefined)),
          stock: v.stock !== undefined ? Number(v.stock) : 0,
          images: Array.isArray(v.images) ? v.images : []
        }))
      : [],
    status: body.status || 'pending',
    featured: Boolean(body.featured),
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
    productType: productType
  });

  res.status(201).json({ success: true, data: created });
});

// PUT /products/:id
router.put('/:id', authenticate, requireRole(['admin','vendor']), requirePermission('products.edit'), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const product = await Product.findById(id);
  if (!product) {
    res.status(404);
    throw new Error('product not found');
  }
  // Vendor can only edit own product
  if (req.user.role === 'vendor' && String(product.vendor) !== String(req.user.vendorId)) {
    res.status(403);
    throw new Error('Forbidden');
  }

  if (body.name !== undefined) product.name = String(body.name).trim();
  if (body.description !== undefined) product.description = String(body.description).trim();
  if (body.shortDescription !== undefined) product.shortDescription = String(body.shortDescription).trim();
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

  // Admin can set admin prices; vendor can set vendor prices
  if (req.user.role === 'admin') {
    if (body.regularPrice !== undefined) product.regularPrice = Number(body.regularPrice);
    if (body.specialPrice !== undefined) product.specialPrice = Number(body.specialPrice);
  }
  if (req.user.role === 'vendor') {
    if (body.vendorRegularPrice !== undefined) product.vendorRegularPrice = Number(body.vendorRegularPrice);
  }
  if (body.tax !== undefined) product.tax = Number(body.tax);
  if (body.stock !== undefined) product.stock = Number(body.stock);

  if (body.images !== undefined) product.images = Array.isArray(body.images) ? body.images : [];
  if (body.imagePublicIds !== undefined) product.imagePublicIds = Array.isArray(body.imagePublicIds) ? body.imagePublicIds : [];
  if (body.videoUrl !== undefined) product.videoUrl = String(body.videoUrl || '').trim();
  if (body.videoPublicId !== undefined) product.videoPublicId = String(body.videoPublicId || '').trim();
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants)) { res.status(400); throw new Error('variants must be an array'); }
    const variantSkus = body.variants.map(v => (v?.sku || '').trim()).filter(Boolean);
    if (variantSkus.length) {
      const dupInPayload = new Set();
      const seen = new Set();
      for (const s of variantSkus) { if (seen.has(s)) dupInPayload.add(s); seen.add(s); }
      if (dupInPayload.size) { res.status(409); throw new Error(`Duplicate variant SKU(s): ${Array.from(dupInPayload).join(', ')}`); }
      // Do not check across other products; uniqueness enforced within product only
    }
    // Preserve vendor variant prices when admin updates
    const existingBySku = new Map((product.variants || []).map(ev => [String(ev.sku || ''), ev]));
    product.variants = body.variants.map(v => {
      const sku = v.sku ? String(v.sku).trim() : undefined;
      const existing = sku ? existingBySku.get(sku) : undefined;
      const isAdmin = req.user.role === 'admin';
      const isVendor = req.user.role === 'vendor';
      // Business rule: vendor sets vendor prices; admin updates should NOT override vendor prices
      const nextVendorPrice = isVendor
        ? (v.vendorPrice !== undefined ? Number(v.vendorPrice) : (v.price !== undefined ? Number(v.price) : (existing?.vendorPrice)))
        : (existing?.vendorPrice);
      return {
        attributes: v.attributes || {},
        sku,
        // Admin can update admin prices; vendor updates should preserve existing admin prices
        price: isAdmin ? (v.price !== undefined ? Number(v.price) : (existing?.price)) : (existing?.price),
        specialPrice: isAdmin ? (v.specialPrice !== undefined ? Number(v.specialPrice) : (existing?.specialPrice)) : (existing?.specialPrice),
        // Vendor prices only change on vendor updates; admin edits never overwrite them
        vendorPrice: nextVendorPrice,
        stock: v.stock !== undefined ? Number(v.stock) : (existing?.stock ?? 0),
        images: Array.isArray(v.images) ? v.images : (existing?.images || [])
      };
    });
  }

  if (body.status !== undefined) product.status = body.status;
  if (body.featured !== undefined) product.featured = Boolean(body.featured);
  if (body.enabled !== undefined) product.enabled = Boolean(body.enabled);

  // Update productType based on variants
  if (body.variants !== undefined) {
    const hasVariants = Array.isArray(body.variants) && body.variants.length > 0;
    const newProductType = hasVariants ? 'configurable' : 'simple';
    
    console.log(`Updating product "${product.name}" type from ${product.productType} to ${newProductType} (variants: ${hasVariants ? body.variants.length : 0})`);
    
    product.productType = newProductType;
  }

  const updated = await product.save();
  res.json({ success: true, data: updated });
});

// Inventory: Update stock and low stock threshold (admin/vendor)
router.patch('/:id/inventory', authenticate, requireRole(['admin','vendor']), requireAnyPermission(['products.edit','products.view']), async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, lowStockAlert } = req.body || {};
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role === 'vendor' && String(product.vendor) !== String(req.user.vendorId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (stock != null) product.stock = Number(stock);
    if (lowStockAlert != null) product.lowStockAlert = Number(lowStockAlert);
    await product.save();
    res.json({ success: true, data: { id: product._id, stock: product.stock, lowStockAlert: product.lowStockAlert || 10 } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to update inventory' });
  }
});

// DELETE /products/:id
router.delete('/:id', authenticate, requireRole(['admin','vendor']), requirePermission('products.delete'), async (req, res) => {
  const { id } = req.params;
  // Enforce vendor ownership for deletion
  if (req.user.role === 'vendor') {
    const doc = await Product.findById(id).select({ vendor: 1 }).lean();
    if (!doc) { res.status(404); throw new Error('product not found'); }
    if (String(doc.vendor) !== String(req.user.vendorId)) { res.status(403); throw new Error('Forbidden'); }
  }
  const deleted = await Product.findByIdAndDelete(id).lean();
  if (!deleted) {
    res.status(404);
    throw new Error('product not found');
  }
  // Remove deleted product from all homepage sections
  try {
    const HomePageSection = require('../models/HomePageSection');
    await HomePageSection.updateMany({}, { $pull: { products: { productId: deleted._id } } });
  } catch (_) {}
  // Note: consider deleting Cloudinary images if imagePublicIds exist
  res.json({ success: true });
});

// PATCH /products/:id/enabled
router.patch('/:id/enabled', authenticate, requireRole(['admin','vendor']), requireAnyPermission(['products.edit','products.delete']), async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body || {};
  if (req.user.role === 'vendor') {
    const doc = await Product.findById(id).select({ vendor: 1 }).lean();
    if (!doc) { res.status(404); throw new Error('product not found'); }
    if (String(doc.vendor) !== String(req.user.vendorId)) { res.status(403); throw new Error('Forbidden'); }
  }
  const updated = await Product.findByIdAndUpdate(id, { enabled: Boolean(enabled) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('product not found');
  }
  res.json({ success: true, data: updated });
});

// Public: Get filter options for products (aggregation)
router.get('/public/filters', async (req, res) => {
  try {
    const { category, includeDescendants } = req.query;
    const baseFilters = { enabled: true };
    let filters = { ...baseFilters };
    let resolvedCategoryId = null;

    if (category) {
      // Resolve id/name/slug; include descendants if requested (default true)
      resolvedCategoryId = String(category);
      try {
        if (!mongoose.Types.ObjectId.isValid(resolvedCategoryId)) {
          const rx = new RegExp('^' + String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
          const catDoc = await Category.findOne({
            $or: [ { name: rx }, { slug: String(category).toLowerCase() } ],
            enabled: true
          }).select('_id').lean();
          if (catDoc && catDoc._id) resolvedCategoryId = String(catDoc._id);
        }
      } catch (_) {}
      if (mongoose.Types.ObjectId.isValid(resolvedCategoryId)) {
        const expand = String(includeDescendants ?? 'true').toLowerCase() === 'true';
        if (expand) {
          const allIds = new Set([resolvedCategoryId]);
          let frontier = [resolvedCategoryId];
          while (frontier.length > 0) {
            const children = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
            const newIds = children.map(c => String(c._id)).filter(id => !allIds.has(id));
            if (newIds.length === 0) break;
            newIds.forEach(id => allIds.add(id));
            frontier = newIds;
          }
          filters.category = { $in: Array.from(allIds).map(id => new mongoose.Types.ObjectId(id)) };
        } else {
          filters.category = new mongoose.Types.ObjectId(resolvedCategoryId);
        }
      }
    }

    // Get price range - consider product prices and variant prices
    const priceStats = await Product.aggregate([
      { $match: filters },
      // Compute variant-level effective prices and choose lowest
      {
        $addFields: {
          _variantEffectivePrices: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
              {
                $map: {
                  input: '$variants',
                  as: 'v',
                  in: {
                    $cond: [
                      { $ne: ['$$v.specialPrice', null] },
                      '$$v.specialPrice',
                      '$$v.price'
                    ]
                  }
                }
              },
              []
            ]
          }
        }
      },
      {
        $addFields: {
          _lowestVariantPrice: {
            $cond: [
              { $gt: [{ $size: '$_variantEffectivePrices' }, 0] },
              { $min: '$_variantEffectivePrices' },
              null
            ]
          }
        }
      },
      {
        $addFields: {
          effectivePrice: {
            $cond: [
              { $ne: ['$specialPrice', null] },
              '$specialPrice',
              {
                $cond: [
                  { $ne: ['$regularPrice', null] },
                  '$regularPrice',
                  { $ifNull: ['$_lowestVariantPrice', 0] }
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$effectivePrice' },
          maxPrice: { $max: '$effectivePrice' },
          avgPrice: { $avg: '$effectivePrice' }
        }
      }
    ]);

    // Get brands
    const brands = await Product.aggregate([
      { $match: filters },
      { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brandInfo' } },
      { $unwind: '$brandInfo' },
      {
        $group: {
          _id: '$brand',
          name: { $first: '$brandInfo.name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    // Get product types
    const productTypes = await Product.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get availability status
    const availability = await Product.aggregate([
      { $match: filters },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: ['$stock', 0] },
              'in_stock',
              'out_of_stock'
            ]
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get rating distribution
    const ratings = await Product.aggregate([
      { $match: { ...filters, rating: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $gte: ['$rating', 4.5] }, then: '4.5+ stars' },
                { case: { $gte: ['$rating', 4.0] }, then: '4.0+ stars' },
                { case: { $gte: ['$rating', 3.5] }, then: '3.5+ stars' },
                { case: { $gte: ['$rating', 3.0] }, then: '3.0+ stars' }
              ],
              default: 'Below 3.0'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get child categories of the provided category (one level down)
    let childCategories = [];
    if (resolvedCategoryId && mongoose.Types.ObjectId.isValid(resolvedCategoryId)) {
      const childDocs = await Category.find({ parent: resolvedCategoryId }).select('_id name').lean();
      const childIds = childDocs.map(c => c._id);
      if (childIds.length > 0) {
        const counts = await Product.aggregate([
          { $match: { ...filters, category: { $in: childIds } } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [String(c._id), c.count]));
        childCategories = childDocs.map(c => ({ id: c._id, name: c.name, count: countMap.get(String(c._id)) || 0 }));
      }
    }

    // Get variant attribute facets (derived from variants.attributes Map)
    let attributeFacets = [];
    try {
      const attrAgg = await Product.aggregate([
        { $match: filters },
        { $unwind: '$variants' },
        {
          $addFields: {
            attrPairs: { $objectToArray: { $ifNull: ['$variants.attributes', {}] } }
          }
        },
        { $unwind: '$attrPairs' },
        { $group: { _id: { key: '$attrPairs.k', value: '$attrPairs.v' }, count: { $sum: 1 } } },
        { $group: { _id: '$_id.key', values: { $push: { value: '$_id.value', count: '$count' } } } },
        { $project: { _id: 0, key: '$_id', values: 1 } },
        { $sort: { key: 1 } }
      ]);
      attributeFacets = (attrAgg || []).map(a => ({ key: a.key, values: a.values }));
    } catch (_) {}

    const filterOptions = {
      priceRange: priceStats[0] ? {
        min: Math.floor(priceStats[0].minPrice),
        max: Math.ceil(priceStats[0].maxPrice),
        avg: Math.round(priceStats[0].avgPrice)
      } : null,
      brands: brands.map(b => ({ id: b._id, name: b.name, count: b.count })),
      productTypes: productTypes.map(t => ({ type: t._id, count: t.count })),
      availability: availability.map(a => ({ status: a._id, count: a.count })),
      ratings: ratings.map(r => ({ range: r._id, count: r.count })),
      childCategories,
      attributes: attributeFacets
    };

    res.json({ success: true, data: filterOptions });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch filter options' });
  }
});

// Public: GET /products/public?category=&q=&page=&limit=&filters=
router.get('/public', async (req, res) => {
  try {
    const { 
      q = '', 
      category, 
      page = 1, 
      limit = 20,
      minPrice,
      maxPrice,
      brands,
      productType,
      availability,
      minRating,
      sortBy = 'newest',
      includeDescendants,
      // attribute filters: attributes[color]=Red,Blue&attributes[size]=M
      attributes
    } = req.query;
    
    console.log('🔍 Backend received request with category:', category);
    console.log('🔍 Backend received request with filters:', { minPrice, maxPrice, brands, productType, availability, minRating, sortBy });
    
    const baseFilters = { enabled: true, status: 'approved' };
    let filters = { ...baseFilters };

    if (q) {
      filters.$or = [
        { name: { $regex: String(q), $options: 'i' } },
        { description: { $regex: String(q), $options: 'i' } }
      ];
    }

    if (category) {
      console.log('🔒 Applying category filter for:', category);
      // Resolve category if a name/slug was passed instead of ObjectId
      let baseCategoryId = String(category);
      try {
        if (!mongoose.Types.ObjectId.isValid(baseCategoryId)) {
          const rx = new RegExp('^' + String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
          const catDoc = await Category.findOne({
            $or: [
              { name: rx },
              { slug: String(category).toLowerCase() }
            ],
            enabled: true
          }).select('_id').lean();
          if (catDoc && catDoc._id) baseCategoryId = String(catDoc._id);
        }
      } catch (_) {}

      const expand = String(includeDescendants ?? 'true').toLowerCase() === 'true';
      if (mongoose.Types.ObjectId.isValid(baseCategoryId)) {
        if (expand) {
          // Include descendants
          const allIds = new Set([baseCategoryId]);
          let frontier = [baseCategoryId];
          while (frontier.length > 0) {
            const children = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
            const newIds = children.map(c => String(c._id)).filter(id => !allIds.has(id));
            if (newIds.length === 0) break;
            newIds.forEach(id => allIds.add(id));
            frontier = newIds;
          }
          filters.category = { $in: Array.from(allIds).map(id => new mongoose.Types.ObjectId(id)) };
          console.log('🔒 Category filter expanded to include descendants');
        } else {
          // Exact category only
          filters.category = new mongoose.Types.ObjectId(baseCategoryId);
          console.log('🔒 Category filter set to single id:', filters.category);
        }
      } else {
        console.log('⚠️ Category not resolved to ObjectId; skipping category filter');
      }
    } else {
      console.log('⚠️ No category specified - will show all products');
    }

    // Apply price filters - numeric-safe using $expr: consider product specialPrice/regularPrice and variant prices
    if (minPrice || maxPrice) {
      const minPriceVal = minPrice ? parseFloat(minPrice) : 0;
      const maxPriceVal = maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER;
      
      console.log('💰 Price filtering:', { minPrice: minPriceVal, maxPrice: maxPriceVal });
      
      // Numeric-aware price filter using $expr and $convert
      const priceExpr = {
        $or: [
          { $expr: { $and: [
            { $ne: ['$specialPrice', null] },
            { $gte: [ { $convert: { input: '$specialPrice', to: 'double', onError: minPriceVal - 1, onNull: minPriceVal - 1 } }, minPriceVal ] },
            { $lte: [ { $convert: { input: '$specialPrice', to: 'double', onError: maxPriceVal + 1, onNull: maxPriceVal + 1 } }, maxPriceVal ] }
          ] } },
          { $expr: { $and: [
            { $or: [ { $eq: ['$specialPrice', null] }, { $not: '$specialPrice' } ] },
            { $ne: ['$regularPrice', null] },
            { $gte: [ { $convert: { input: '$regularPrice', to: 'double', onError: minPriceVal - 1, onNull: minPriceVal - 1 } }, minPriceVal ] },
            { $lte: [ { $convert: { input: '$regularPrice', to: 'double', onError: maxPriceVal + 1, onNull: maxPriceVal + 1 } }, maxPriceVal ] }
          ] } },
          { $expr: {
            $gt: [
              { $size: {
                $filter: {
                  input: {
                    $map: {
                      input: { $ifNull: ['$variants', []] },
                      as: 'v',
                      in: {
                        $convert: {
                          input: { $cond: [ { $ne: ['$$v.specialPrice', null] }, '$$v.specialPrice', '$$v.price' ] },
                          to: 'double', onError: null, onNull: null
                        }
                      }
                    }
                  },
                  as: 'p',
                  cond: { $and: [ { $ne: ['$$p', null] }, { $gte: ['$$p', minPriceVal] }, { $lte: ['$$p', maxPriceVal] } ] }
                }
              } },
              0
            ]
          } }
        ]
      };

      // Merge priceExpr into filters, preserving existing search $or if any
      if (filters.$and) {
        filters.$and.push(priceExpr);
      } else if (filters.$or) {
        const existingOr = filters.$or;
        delete filters.$or;
        filters.$and = [ { $or: existingOr }, priceExpr ];
      } else {
        filters.$and = [ priceExpr ];
      }
      
      console.log('🔍 Final filters object:', JSON.stringify(filters, null, 2));
    }

  // Debug: Log the final query being executed
  console.log('🚀 Executing query with filters:', JSON.stringify(filters, null, 2));
  
  // Also log the query parameters for debugging
  console.log('📋 Query params:', { q, category, minPrice, maxPrice, brands, productType, availability, minRating, sortBy });

    // Apply brand filters
    if (brands) {
      const brandIds = brands.split(',').map(id => id.trim()).filter(Boolean);
      if (brandIds.length > 0) {
        const brandObjIds = brandIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));
        if (brandObjIds.length > 0) {
          filters.brand = { $in: brandObjIds };
        }
      }
    }

    // Apply product type filter
    if (productType && productType !== 'all') {
      filters.productType = productType;
    }

    // Apply availability filter
    if (availability === 'in_stock') {
      filters.stock = { $gt: 0 };
    } else if (availability === 'out_of_stock') {
      filters.stock = { $lte: 0 };
    }

    // Apply rating filter
    if (minRating) {
      filters.rating = { $gte: parseFloat(minRating) };
    }

    // Determine sort order
    let sortOrder = {};
    switch (sortBy) {
      case 'price_low':
        // For price sorting, we'll use aggregation to calculate effective price
        sortOrder = { createdAt: -1 }; // Default sort, will be overridden in aggregation
        break;
      case 'price_high':
        // For price sorting, we'll use aggregation to calculate effective price
        sortOrder = { createdAt: -1 }; // Default sort, will be overridden in aggregation
        break;
      case 'rating':
        sortOrder = { rating: -1 };
        break;
      case 'name':
        sortOrder = { name: 1 };
        break;
      case 'newest':
      default:
        sortOrder = { createdAt: -1 };
        break;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    // Build attribute filters if provided (support both object and attributes[key] style)
    let variantAttrMatch = null; // simple $match structure
    let variantAttrExpr = null; // $expr-based case-insensitive structure
    try {
      // Build attributes object from both nested and bracketed query forms
      let attributesObj = {};
      if (attributes && typeof attributes === 'object') {
        Object.assign(attributesObj, attributes);
      }
      for (const key of Object.keys(req.query)) {
        const m = /^attributes\[(.+?)\]$/.exec(key);
        if (m) {
          const attrKey = m[1];
          const raw = req.query[key];
          const vals = String(raw).split(',').map(s => s.trim()).filter(Boolean);
          if (vals.length > 0) attributesObj[attrKey] = vals;
        }
      }
      if (Object.keys(attributesObj).length === 0) attributesObj = null;
      if (attributesObj && typeof attributesObj === 'object') {
        const attrConds = [];
        const exprConds = [];
        for (const [attrKey, attrValuesRaw] of Object.entries(attributesObj)) {
          if (attrValuesRaw == null) continue;
          const values = Array.isArray(attrValuesRaw) ? attrValuesRaw : String(attrValuesRaw).split(',');
          const cleaned = values.map(v => String(v).trim()).filter(Boolean);
          if (cleaned.length === 0) continue;
          // Simple regex-based $match for direct string storage
          const regexes = cleaned.map(v => new RegExp('^' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'));
          const keyPath = `variants.attributes.${attrKey}`;
          attrConds.push({ [keyPath]: { $in: regexes } });
          // $expr-based match for Map/object-to-array case-insensitive compare
          const keyLower = String(attrKey).toLowerCase();
          const valsLower = cleaned.map(v => String(v).toLowerCase());
          exprConds.push({
            $gt: [
              { $size: {
                $filter: {
                  input: { $objectToArray: { $ifNull: ['$variants.attributes', {}] } },
                  as: 'p',
                  cond: {
                    $and: [
                      { $eq: [ { $toLower: { $trim: { input: { $convert: { input: '$$p.k', to: 'string', onError: '', onNull: '' } } } } }, keyLower ] },
                      {
                        $let: {
                          vars: {
                            vlist: {
                              $cond: [
                                { $eq: [ { $type: '$$p.v' }, 'array' ] },
                                { $map: { input: '$$p.v', as: 'vv', in: { $toLower: { $trim: { input: { $convert: { input: '$$vv', to: 'string', onError: '', onNull: '' } } } } } } },
                                [ { $toLower: { $trim: { input: { $convert: { input: '$$p.v', to: 'string', onError: '', onNull: '' } } } } } ]
                              ]
                            }
                          },
                          in: { $gt: [ { $size: { $setIntersection: ['$$vlist', valsLower] } }, 0 ] }
                        }
                      }
                    ]
                  }
                }
              } },
              0
            ]
          });
        }
        if (attrConds.length > 0) {
          variantAttrMatch = { $and: attrConds };
        }
        if (exprConds.length > 0) {
          variantAttrExpr = { $and: exprConds };
        }
      }
    } catch (_) {}

    let items, total;
    
    // Handle price sorting with aggregation for effective price calculation
    if (sortBy === 'price_low' || sortBy === 'price_high') {
      const sortDirection = sortBy === 'price_low' ? 1 : -1;
      const rangeMin = minPrice != null ? parseFloat(minPrice) : null;
      const rangeMax = maxPrice != null ? parseFloat(maxPrice) : null;
      const minBound = Number.isFinite(rangeMin) ? rangeMin : -1e12;
      const maxBound = Number.isFinite(rangeMax) ? rangeMax : 1e12;
      
      const aggregationPipeline = [
        { $match: filters },
      ];
      // If filtering by variant attributes, limit products to those having matching variants
      if (variantAttrMatch || variantAttrExpr) {
        aggregationPipeline.push(
          { $unwind: '$variants' },
          { $match: { $or: [
            ...(variantAttrExpr ? [ { $expr: variantAttrExpr } ] : []),
            ...(variantAttrMatch ? [ variantAttrMatch ] : [])
          ] } },
          { $group: { _id: '$_id', doc: { $first: '$$ROOT' } } },
          { $replaceRoot: { newRoot: '$doc' } },
        );
      }
      aggregationPipeline.push(
        // Build list of all relevant prices: product-level and variant-level
        {
          $addFields: {
            _variantEffectivePrices: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
                {
                  $map: {
                    input: '$variants',
                    as: 'v',
                    in: {
                      $cond: [
                        { $ne: ['$$v.specialPrice', null] },
                        '$$v.specialPrice',
                        '$$v.price'
                      ]
                    }
                  }
                },
                []
              ]
            }
          }
        },
        {
          $addFields: {
            _allPrices: {
              $concatArrays: [
                { $cond: [ { $ne: ['$specialPrice', null] }, [ '$specialPrice' ], [] ] },
                { $cond: [ { $ne: ['$regularPrice', null] }, [ '$regularPrice' ], [] ] },
                '$_variantEffectivePrices'
              ]
            }
          }
        },
        // Convert all prices to numeric and drop nulls
        {
          $addFields: {
            _numericPrices: {
              $filter: {
                input: {
                  $map: {
                    input: '$_allPrices',
                    as: 'p',
                    in: { $convert: { input: '$$p', to: 'double', onError: null, onNull: null } }
                  }
                },
                as: 'n',
                cond: { $ne: ['$$n', null] }
              }
            }
          }
        },
        // Compute in-range prices only, based on selected slider bounds
        {
          $addFields: {
            _inRangePrices: {
              $filter: {
                input: '$_numericPrices',
                as: 'x',
                cond: { $and: [ { $gte: ['$$x', minBound] }, { $lte: ['$$x', maxBound] } ] }
              }
            }
          }
        },
        // Keep only items that have at least one price in range
        { $match: { $expr: { $gt: [ { $size: '$_inRangePrices' }, 0 ] } } },
        // Effective price for sort: min of in-range for low, max of in-range for high
        {
          $addFields: {
            effectivePrice: sortBy === 'price_low' ? { $min: '$_inRangePrices' } : { $max: '$_inRangePrices' }
          }
        },
        { $sort: { effectivePrice: sortDirection } },
        { $skip: (pageNum - 1) * perPage },
        { $limit: perPage },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $lookup: {
            from: 'brands',
            localField: 'brand',
            foreignField: '_id',
            as: 'brand'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            name: 1,
            images: 1,
            regularPrice: 1,
            specialPrice: 1,
            rating: 1,
            productType: 1,
            variants: 1,
            stock: 1,
            effectivePrice: 1,
            category: { name: '$category.name' },
            brand: { name: '$brand.name' }
          }
        }
      );
      
      // Strip vendorSpecialPrice from variants if present in aggregation result
      if (variantAttrMatch) {
        [items, total] = await Promise.all([
          Product.aggregate(aggregationPipeline),
          Product.aggregate([
            { $match: filters },
            { $unwind: '$variants' },
            { $match: variantAttrMatch },
            { $group: { _id: '$_id' } },
            { $count: 'count' }
          ]).then(r => (r && r[0] && r[0].count) || 0)
        ]);
      } else {
        [items, total] = await Promise.all([
          Product.aggregate(aggregationPipeline),
          Product.countDocuments(filters)
        ]);
      }
      items = (items || []).map(doc => ({
        ...doc,
        variants: Array.isArray(doc.variants) ? doc.variants.map(v => {
          const { vendorSpecialPrice, ...rest } = v || {};
          return rest;
        }) : []
      }));
      
      console.log('📊 Aggregation results:', items.length, 'items');
      if (items.length > 0) {
        console.log('💰 Sample prices from aggregation:', items.slice(0, 3).map(item => ({
          name: item.name,
          regularPrice: item.regularPrice,
          specialPrice: item.specialPrice
        })));
      }
    } else {
      // Use regular find for non-price sorting
      if (sortBy === 'rating') {
        // Compute average rating from approved reviews and sort by it
        const filtersForRating = { ...filters };
        // Remove product.rating filter if present; we'll apply minRating to computed avg instead
        if (Object.prototype.hasOwnProperty.call(filtersForRating, 'rating')) delete filtersForRating.rating;
        const ratingPipeline = [
          { $match: filtersForRating },
        ];
        if (variantAttrMatch || variantAttrExpr) {
          ratingPipeline.push(
            { $unwind: '$variants' },
            { $match: { $or: [
              ...(variantAttrExpr ? [ { $expr: variantAttrExpr } ] : []),
              ...(variantAttrMatch ? [ variantAttrMatch ] : [])
            ] } },
            { $group: { _id: '$_id', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
          );
        }
        ratingPipeline.push(
          {
            $lookup: {
              from: 'reviews',
              let: { pid: '$_id' },
              pipeline: [
                { $match: { $expr: { $and: [ { $eq: ['$product', '$$pid'] }, { $eq: ['$status', 'approved'] } ] } } },
                { $project: { rating: 1 } }
              ],
              as: 'reviews'
            }
          },
          {
            $addFields: {
              computedAvgRating: {
                $cond: [ { $gt: [ { $size: '$reviews' }, 0 ] }, { $avg: '$reviews.rating' }, 0 ]
              },
              computedReviewsCount: { $size: '$reviews' }
            }
          },
        );
        // Apply minRating to computedAvgRating if provided
        if (minRating) {
          ratingPipeline.push({ $match: { computedAvgRating: { $gte: parseFloat(minRating) } } });
        }
        ratingPipeline.push(
          { $sort: { computedAvgRating: -1, computedReviewsCount: -1, createdAt: -1 } },
          { $skip: (pageNum - 1) * perPage },
          { $limit: perPage },
          { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
          { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 1, name: 1, images: 1, regularPrice: 1, specialPrice: 1, vendorRegularPrice: 1, productType: 1, variants: 1, stock: 1, rating: '$computedAvgRating', reviewsCount: '$computedReviewsCount', category: { name: '$category.name' }, brand: { name: '$brand.name' } } }
        );
        [items, total] = await Promise.all([
          Product.aggregate(ratingPipeline),
          Product.countDocuments(filtersForRating)
        ]);
      } else if (variantAttrMatch || variantAttrExpr) {
        const basePipeline = [
          { $match: filters },
          { $unwind: '$variants' },
          { $match: { $or: [
            ...(variantAttrExpr ? [ { $expr: variantAttrExpr } ] : []),
            ...(variantAttrMatch ? [ variantAttrMatch ] : [])
          ] } },
          {
            $group: {
              _id: '$_id',
              doc: { $first: '$$ROOT' }
            }
          },
          { $replaceRoot: { newRoot: '$doc' } },
          { $sort: sortOrder },
          { $skip: (pageNum - 1) * perPage },
          { $limit: perPage },
          { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
          { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, name: 1, images: 1, regularPrice: 1, specialPrice: 1, vendorRegularPrice: 1, rating: 1, productType: 1, variants: 1, stock: 1, videoUrl: 1, effectivePrice: 1, category: { name: '$category.name' }, brand: { name: '$brand.name' } } }
        ];
        [items, total] = await Promise.all([
          Product.aggregate(basePipeline),
          Product.aggregate([
            { $match: filters },
            { $unwind: '$variants' },
            { $match: { $or: [
              ...(variantAttrExpr ? [ { $expr: variantAttrExpr } ] : []),
              ...(variantAttrMatch ? [ variantAttrMatch ] : [])
            ] } },
            { $group: { _id: '$_id' } },
            { $count: 'count' }
          ]).then(r => (r && r[0] && r[0].count) || 0)
        ]);
      } else {
        [items, total] = await Promise.all([
          Product.find(filters)
            .select('_id name images regularPrice specialPrice vendorRegularPrice rating productType variants stock brand videoUrl')
            .populate('category', 'name')
            .populate('brand', 'name')
            .sort(sortOrder)
            .skip((pageNum - 1) * perPage)
            .limit(perPage)
            .lean(),
          Product.countDocuments(filters)
        ]);
      }
      // Strip vendorSpecialPrice from variants if present
      items = (items || []).map(doc => ({
        ...doc,
        variants: Array.isArray(doc.variants) ? doc.variants.map(v => {
          const { vendorSpecialPrice, ...rest } = v || {};
          return rest;
        }) : []
      }));
      
      console.log('📊 Find results:', items.length, 'items');
      if (items.length > 0) {
        console.log('💰 Sample prices from find:', items.slice(0, 3).map(item => ({
          name: item.name,
          regularPrice: item.regularPrice,
          specialPrice: item.specialPrice
        })));
      }
    }

    // Targeted fallback: If no results, relax only the status filter (keep category and others intact)
    if ((items?.length || 0) === 0) {
      try {
        const relaxed = { ...filters };
        if (relaxed.status) delete relaxed.status;
        if (sortBy === 'price_low' || sortBy === 'price_high') {
          // Use a simple find fallback to avoid complex price aggregation
          const pageNum2 = Math.max(parseInt(page, 10) || 1, 1);
          const perPage2 = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
          const [alt, tot] = await Promise.all([
            Product.find(relaxed)
              .select('_id name images regularPrice specialPrice vendorRegularPrice rating productType variants stock brand videoUrl')
              .populate('category', 'name')
              .populate('brand', 'name')
              .sort(sortOrder)
              .skip((pageNum2 - 1) * perPage2)
              .limit(perPage2)
              .lean(),
            Product.countDocuments(relaxed)
          ]);
          items = (alt || []).map(doc => ({
            ...doc,
            variants: Array.isArray(doc.variants) ? doc.variants.map(v => { const { vendorSpecialPrice, ...rest } = v || {}; return rest; }) : []
          }));
          total = tot || 0;
        } else {
          const pageNum2 = Math.max(parseInt(page, 10) || 1, 1);
          const perPage2 = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
          const [alt, tot] = await Promise.all([
            Product.find(relaxed)
              .select('_id name images regularPrice specialPrice vendorRegularPrice rating productType variants stock brand videoUrl')
              .populate('category', 'name')
              .populate('brand', 'name')
              .sort(sortOrder)
              .skip((pageNum2 - 1) * perPage2)
              .limit(perPage2)
              .lean(),
            Product.countDocuments(relaxed)
          ]);
          items = (alt || []).map(doc => ({
            ...doc,
            variants: Array.isArray(doc.variants) ? doc.variants.map(v => { const { vendorSpecialPrice, ...rest } = v || {}; return rest; }) : []
          }));
          total = tot || 0;
        }
      } catch (_) {}
    }

    // Secondary fallback: if still empty and category present, expand to descendants with relaxed status
    if ((items?.length || 0) === 0 && category) {
      try {
        // Resolve base category id again
        let baseCategoryId = String(category);
        if (!mongoose.Types.ObjectId.isValid(baseCategoryId)) {
          const rx = new RegExp('^' + String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
          const catDoc = await Category.findOne({ $or: [ { name: rx }, { slug: String(category).toLowerCase() } ] }).select('_id').lean();
          if (catDoc && catDoc._id) baseCategoryId = String(catDoc._id);
        }
        if (mongoose.Types.ObjectId.isValid(baseCategoryId)) {
          const allIds = new Set([baseCategoryId]);
          let frontier = [baseCategoryId];
          while (frontier.length > 0) {
            const children = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
            const newIds = children.map(c => String(c._id)).filter(id => !allIds.has(id));
            if (newIds.length === 0) break;
            newIds.forEach(id => allIds.add(id));
            frontier = newIds;
          }
          const relaxed = { ...filters, category: { $in: Array.from(allIds).map(id => new mongoose.Types.ObjectId(id)) } };
          if (relaxed.status) delete relaxed.status;
          const pageNum3 = Math.max(parseInt(page, 10) || 1, 1);
          const perPage3 = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
          const [alt2, tot2] = await Promise.all([
            Product.find(relaxed)
              .select('_id name images regularPrice specialPrice vendorRegularPrice rating productType variants stock brand videoUrl')
              .populate('category', 'name')
              .populate('brand', 'name')
              .sort(sortOrder)
              .skip((pageNum3 - 1) * perPage3)
              .limit(perPage3)
              .lean(),
            Product.countDocuments(relaxed)
          ]);
          items = (alt2 || []).map(doc => ({
            ...doc,
            variants: Array.isArray(doc.variants) ? doc.variants.map(v => { const { vendorSpecialPrice, ...rest } = v || {}; return rest; }) : []
          }));
          total = tot2 || 0;
        }
      } catch (_) {}
    }

    // No fallback relaxation; if filters yield no results, return empty

    // Enrich with rating and reviewsCount from approved reviews
    try {
      const productIds = (items || []).map(it => it._id).filter(Boolean);
      if (productIds.length) {
        const stats = await Review.aggregate([
          { $match: { product: { $in: productIds }, status: 'approved' } },
          { $group: { _id: '$product', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        const map = new Map(stats.map(s => [String(s._id), s]));
        items.forEach(it => {
          const st = map.get(String(it._id));
          if (st) {
            const avg = typeof st.avgRating === 'number' ? st.avgRating : 0;
            it.rating = Number(avg.toFixed(1));
            it.reviewsCount = st.count || 0;
          } else {
            // Ensure fields exist for frontend formatting
            it.rating = Number(it.rating || 0);
            if (it.reviewsCount == null) it.reviewsCount = 0;
          }
        });
      }
    } catch (_) {
      // ignore enrichment failures
    }

    res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch products' });
  }
});

// Public: Get related products for a given product
router.get('/:id/related/public', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).select('relatedProducts category').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let items = [];
    if (product.relatedProducts && product.relatedProducts.length > 0) {
      items = await Product.find({ _id: { $in: product.relatedProducts }, enabled: true, status: 'approved' })
        .select('_id name images regularPrice specialPrice rating productType variants')
        .populate('category', 'name')
        .limit(12)
        .lean();
    } else if (product.category) {
      items = await Product.find({ category: product.category, _id: { $ne: id }, enabled: true, status: 'approved' })
        .select('_id name images regularPrice specialPrice rating productType variants')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();
    }

    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch related products' });
  }
});

// Admin: Set related products for a product
router.put('/:id/related', authenticate, requireRole(['admin','vendor']), requirePermission('products.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { relatedProductIds } = req.body || {};
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    product.relatedProducts = Array.isArray(relatedProductIds) ? relatedProductIds : [];
    await product.save();
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to update related products' });
  }
});

// Admin/Vendor: Get related products for a product (no public filtering)
router.get('/:id/related', authenticate, requireRole(['admin','vendor']), requirePermission('products.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).select('relatedProducts').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const ids = Array.isArray(product.relatedProducts) ? product.relatedProducts : [];
    if (!ids.length) return res.json({ success: true, data: [] });
    const items = await Product.find({ _id: { $in: ids } })
      .select('_id name images regularPrice specialPrice vendorRegularPrice')
      .lean();
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch related products' });
  }
});

// Public: Get single product details
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .select('name description shortDescription images regularPrice specialPrice vendorRegularPrice tax stock productType variants category brand vendor enabled status videoUrl')
      .populate('brand', 'name')
      .populate('category', 'name')
      .populate('vendor', 'companyName')
      .lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.status !== 'approved' || !product.enabled) {
      return res.status(403).json({ success: false, message: 'Product not available' });
    }

    // Normalize variant attributes to plain object
    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map(v => ({
        attributes: v.attributes && typeof v.attributes === 'object' && !(v.attributes instanceof Array) ? v.attributes : (v.attributes || {}),
        sku: v.sku,
        price: v.price,
        specialPrice: v.specialPrice,
        stock: v.stock,
        images: v.images || []
      }));
    }

    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch product' });
  }
});

// Public: Get product reviews (approved only)
router.get('/:id/reviews/public', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, rating } = req.query;
    const filters = { product: id, status: 'approved' };
    if (rating) filters.rating = Number(rating);
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const [items, total] = await Promise.all([
      Review.find(filters).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email').lean(),
      Review.countDocuments(filters)
    ]);
    const mapped = items.map(r => ({
      id: r._id,
      reviewerName: r.user?.name || r.user?.email || 'Customer',
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      createdAt: r.createdAt,
      images: r.images || []
    }));
    res.json({ success: true, data: mapped, meta: { total, page: p, limit: l } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load product reviews' });
  }
});

// Admin: Get single product (full)
router.get('/:id', authenticate, requireRole(['admin','vendor']), requirePermission('products.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Product.findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('vendor', 'companyName')
      .lean();
    if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
    const sanitized = {
      ...item,
      variants: Array.isArray(item.variants) ? item.variants.map(v => {
        const { vendorSpecialPrice, ...rest } = v || {};
        return rest;
      }) : []
    };
    res.json({ success: true, data: sanitized });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch product' });
  }
});

module.exports = router;