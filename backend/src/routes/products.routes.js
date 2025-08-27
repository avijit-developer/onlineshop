const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin, requireRole, requirePermission, requireAnyPermission } = require('../middleware/auth');
const { uploadImageBuffer, deleteImageByPublicId } = require('../config/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 } });

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

  // Enforce vendor scoping
  if (req.user.role === 'vendor') {
    body.vendor = req.user.vendorId;
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
    regularPrice: Number(body.regularPrice),
    specialPrice: body.specialPrice !== undefined ? Number(body.specialPrice) : undefined,
    tax: body.tax !== undefined ? Number(body.tax) : undefined,
    stock: body.stock !== undefined ? Number(body.stock) : undefined,
    images: Array.isArray(body.images) ? body.images : [],
    imagePublicIds: Array.isArray(body.imagePublicIds) ? body.imagePublicIds : [],
    variants: hasVariants
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
    const { category } = req.query;
    const baseFilters = { enabled: true, status: { $ne: 'rejected' } };
    let filters = { ...baseFilters };

    if (category) {
      // Include products in the selected category and all descendants
      const allIds = new Set([String(category)]);
      let frontier = [String(category)];
      while (frontier.length > 0) {
        const children = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
        const newIds = children
          .map(c => String(c._id))
          .filter(id => !allIds.has(id));
        if (newIds.length === 0) break;
        newIds.forEach(id => allIds.add(id));
        frontier = newIds;
      }
      const objectIdList = Array.from(allIds).map(id => new mongoose.Types.ObjectId(id));
      filters.category = { $in: objectIdList };
    }

    // Get price range - consider both special and regular prices
    const priceStats = await Product.aggregate([
      { $match: filters },
      {
        $addFields: {
          effectivePrice: {
            $cond: {
              if: { $ne: ['$specialPrice', null] },
              then: '$specialPrice',
              else: '$regularPrice'
            }
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
    if (category) {
      const childDocs = await Category.find({ parent: category }).select('_id name').lean();
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
      childCategories
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
      sortBy = 'newest'
    } = req.query;
    
    console.log('🔍 Backend received request with category:', category);
    console.log('🔍 Backend received request with filters:', { minPrice, maxPrice, brands, productType, availability, minRating, sortBy });
    
    const baseFilters = { enabled: true, status: { $ne: 'rejected' } };
    let filters = { ...baseFilters };

    if (q) {
      filters.$or = [
        { name: { $regex: String(q), $options: 'i' } },
        { description: { $regex: String(q), $options: 'i' } }
      ];
    }

    if (category) {
      console.log('🔒 Applying category filter for:', category);
      // Include products in the selected category and all descendants
      const allIds = new Set([String(category)]);
      let frontier = [String(category)];
      while (frontier.length > 0) {
        const children = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
        const newIds = children
          .map(c => String(c._id))
          .filter(id => !allIds.has(id));
        if (newIds.length === 0) break;
        newIds.forEach(id => allIds.add(id));
        frontier = newIds;
      }
      const objectIdList = Array.from(allIds).map(id => new mongoose.Types.ObjectId(id));
      filters.category = { $in: objectIdList };
      console.log('🔒 Category filter expanded to include:', objectIdList);
    } else {
      console.log('⚠️ No category specified - will show all products');
    }

        // Apply price filters - prefer specialPrice when present, otherwise use regularPrice
    if (minPrice || maxPrice) {
      const minPriceVal = minPrice ? parseFloat(minPrice) : 0;
      const maxPriceVal = maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER;
      
      console.log('💰 Price filtering:', { minPrice: minPriceVal, maxPrice: maxPriceVal });
      
      // Create price filter with preference for specialPrice when it exists
      const priceFilter = {
        $or: [
          // If specialPrice exists, it must fall within range
          {
            $and: [
              { specialPrice: { $exists: true, $ne: null } },
              { specialPrice: { $gte: minPriceVal, $lte: maxPriceVal } }
            ]
          },
          // If specialPrice does not exist, fallback to regularPrice range
          {
            $and: [
              { $or: [ { specialPrice: { $exists: false } }, { specialPrice: null } ] },
              { regularPrice: { $gte: minPriceVal, $lte: maxPriceVal } }
            ]
          }
        ]
      };
      
      // If we already have $or filters (from search), combine them with $and
      if (filters.$or) {
        const searchFilters = filters.$or;
        filters.$and = [
          { $or: searchFilters },
          { $or: priceFilter.$or }
        ];
        delete filters.$or; // Remove the old $or
      } else {
        // No existing $or filters, use price filter directly
        filters.$or = priceFilter.$or;
      }
      
      console.log('🔍 Final filters object:', JSON.stringify(filters, null, 2));
    }

  // Debug: Log the final query being executed
  console.log('🚀 Executing query with filters:', JSON.stringify(filters, null, 2));
  
  // Also log the query parameters for debugging
  console.log('📋 Query params:', { q, category, minPrice, maxPrice, brands, productType, availability, minRating, sortBy });

    // Apply brand filters
    if (brands) {
      const brandIds = brands.split(',').map(id => id.trim());
      if (brandIds.length > 0) {
        filters.brand = { $in: brandIds };
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

    let items, total;
    
    // Handle price sorting with aggregation for effective price calculation
    if (sortBy === 'price_low' || sortBy === 'price_high') {
      const sortDirection = sortBy === 'price_low' ? 1 : -1;
      
      const aggregationPipeline = [
        { $match: filters },
        {
          $addFields: {
            effectivePrice: {
              $cond: {
                if: { $ne: ['$specialPrice', null] },
                then: '$specialPrice',
                else: '$regularPrice'
              }
            }
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
            brand: 1,
            'category.name': 1,
            'brand.name': 1
          }
        }
      ];
      
      [items, total] = await Promise.all([
        Product.aggregate(aggregationPipeline),
        Product.countDocuments(filters)
      ]);
      
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
      [items, total] = await Promise.all([
        Product.find(filters)
          .select('_id name images regularPrice specialPrice rating productType variants stock brand')
          .populate('category', 'name')
          .populate('brand', 'name')
          .sort(sortOrder)
          .skip((pageNum - 1) * perPage)
          .limit(perPage)
          .lean(),
        Product.countDocuments(filters)
      ]);
      
      console.log('📊 Find results:', items.length, 'items');
      if (items.length > 0) {
        console.log('💰 Sample prices from find:', items.slice(0, 3).map(item => ({
          name: item.name,
          regularPrice: item.regularPrice,
          specialPrice: item.specialPrice
        })));
      }
    }

    // Fallback: if no results and a category was specified, try relaxing filters further
    if ((items?.length || 0) === 0 && category) {
      filters = { enabled: true };
      if (q) {
        filters.$or = [
          { name: { $regex: String(q), $options: 'i' } },
          { description: { $regex: String(q), $options: 'i' } }
        ];
      }
      const allIds = new Set([String(category)]);
      let frontier = [String(category)];
      while (frontier.length > 0) {
        const children = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
        const newIds = children
          .map(c => String(c._id))
          .filter(id => !allIds.has(id));
        if (newIds.length === 0) break;
        newIds.forEach(id => allIds.add(id));
        frontier = newIds;
      }
      const objectIdList = Array.from(allIds).map(id => new mongoose.Types.ObjectId(id));
      filters.category = { $in: objectIdList };

      // Fallback also needs to handle price sorting
      if (sortBy === 'price_low' || sortBy === 'price_high') {
        const sortDirection = sortBy === 'price_low' ? 1 : -1;
        
        const fallbackPipeline = [
          { $match: filters },
          {
            $addFields: {
              effectivePrice: {
                $cond: {
                  if: { $ne: ['$specialPrice', null] },
                  then: '$specialPrice',
                  else: '$regularPrice'
                }
              }
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
              brand: 1,
              'category.name': 1,
              'brand.name': 1
            }
          }
        ];
        
        [items, total] = await Promise.all([
          Product.aggregate(fallbackPipeline),
          Product.countDocuments(filters)
        ]);
      } else {
        [items, total] = await Promise.all([
          Product.find(filters)
            .select('_id name images regularPrice specialPrice rating productType variants stock brand')
            .populate('category', 'name')
            .populate('brand', 'name')
            .sort(sortOrder)
            .skip((pageNum - 1) * perPage)
            .limit(perPage)
            .lean(),
          Product.countDocuments(filters)
        ]);
      }
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
      items = await Product.find({ _id: { $in: product.relatedProducts }, enabled: true, status: { $ne: 'rejected' } })
        .select('_id name images regularPrice specialPrice rating productType variants')
        .populate('category', 'name')
        .limit(12)
        .lean();
    } else if (product.category) {
      items = await Product.find({ category: product.category, _id: { $ne: id }, enabled: true, status: { $ne: 'rejected' } })
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

// Public: Get single product details
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .select('name description shortDescription images regularPrice specialPrice tax stock productType variants category brand vendor enabled status')
      .populate('brand', 'name')
      .populate('category', 'name')
      .populate('vendor', 'companyName')
      .lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.status === 'rejected' || !product.enabled) {
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
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch product' });
  }
});

module.exports = router;