const express = require('express');
const HomePageSection = require('../models/HomePageSection');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Seed default sections (Admin)
router.post('/sections/init', authenticate, requireAdmin, async (req, res) => {
  try {
    const count = await HomePageSection.countDocuments();
    if (count > 0) {
      return res.json({ success: true, message: 'Sections already initialized' });
    }

    const defaultSections = [
      {
        name: 'most-popular',
        title: 'Most Popular',
        subtitle: 'Trending products everyone loves',
        isActive: true,
        order: 1,
        type: 'auto-popular',
        settings: { maxProducts: 10, showPrice: true, showRating: true, layout: 'horizontal', showTags: true },
        autoSettings: { minSales: 5, minRating: 0, daysBack: 30 }
      },
      {
        name: 'best-seller',
        title: 'Best Sellers',
        subtitle: 'Top performing products',
        isActive: true,
        order: 2,
        type: 'auto-popular',
        settings: { maxProducts: 8, showPrice: true, showRating: true, layout: 'horizontal', showTags: true },
        autoSettings: { minSales: 10, minRating: 0, daysBack: 60 }
      },
      {
        name: 'just-for-you',
        title: 'Just For You',
        subtitle: 'Personalized recommendations',
        isActive: true,
        order: 3,
        type: 'auto-recent',
        settings: { maxProducts: 12, showPrice: true, showRating: true, layout: 'grid', showTags: true },
        autoSettings: { minRating: 0, daysBack: 7 }
      },
      {
        name: 'new-arrivals',
        title: 'New Arrivals',
        subtitle: 'Fresh products just added',
        isActive: true,
        order: 4,
        type: 'auto-recent',
        settings: { maxProducts: 6, showPrice: true, showRating: false, layout: 'horizontal', showTags: true },
        autoSettings: { minRating: 0, daysBack: 14 }
      }
    ];

    await HomePageSection.insertMany(defaultSections);
    res.status(201).json({ success: true, message: 'Default sections created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all homepage sections (Admin)
router.get('/sections', authenticate, requireAdmin, async (req, res) => {
  try {
    const sections = await HomePageSection.find()
      .populate('products.productId', 'name images regularPrice specialPrice featured salesCount status enabled rating')
      .sort({ order: 1 });
    
    res.json({ success: true, data: sections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get homepage sections (Public - for mobile app)
router.get('/sections/public', async (req, res) => {
  try {
    console.log('Homepage: Fetching public sections...');
    const sections = await HomePageSection.find({ isActive: true })
      .populate('products.productId', 'name images regularPrice specialPrice featured salesCount status enabled rating')
      .sort({ order: 1 });

    console.log('Homepage: Found sections:', sections.length);

    // Filter out inactive products and populate auto-generated products
    const processedSections = await Promise.all(sections.map(async (section) => {
      console.log(`Homepage: Processing section "${section.name}" (type: ${section.type})`);
      
      // Try strict filter first (approved + enabled)
      let products = section.products
        .filter(p => p.productId && p.productId.status === 'approved' && p.productId.enabled)
        .sort((a, b) => a.order - b.order)
        .slice(0, section.settings.maxProducts);

      // Relax filter if none found: allow any enabled and not rejected
      // No relaxed fallback; only approved items should show

      console.log(`Homepage: Section "${section.name}" has ${products.length} manual products`);

      // If auto-type and not enough products, fetch more
      if (section.type !== 'manual' && products.length < section.settings.maxProducts) {
        console.log(`Homepage: Section "${section.name}" needs auto-products (has ${products.length}, needs ${section.settings.maxProducts})`);
        const autoProducts = await getAutoProducts(section);
        console.log(`Homepage: Section "${section.name}" got ${autoProducts.length} auto-products`);
        
        const existingIds = products.map(p => p.productId._id.toString());
        const newProducts = autoProducts
          .filter(p => !existingIds.includes(p._id.toString()))
          .slice(0, section.settings.maxProducts - products.length);
        
        console.log(`Homepage: Section "${section.name}" adding ${newProducts.length} new auto-products`);
        products = [...products, ...newProducts.map(p => ({ productId: p, order: 999 }))];
      }

      // Final fallback: if still empty, show any enabled non-rejected products
      if (products.length === 0) {
        const fallbackAuto = await Product.find({ enabled: true, status: { $ne: 'rejected' } })
          .sort({ createdAt: -1 })
          .limit(section.settings.maxProducts);
        console.log(`Homepage: Section "${section.name}" using fallback products: ${fallbackAuto.length}`);
        products = fallbackAuto.map(p => ({ productId: p, order: 999 }));
      }

      console.log(`Homepage: Section "${section.name}" final product count: ${products.length}`);

      // Compute live rating and count from reviews collection for these products
      const ids = products.map(p => p.productId._id);
      const reviewAgg = await Review.aggregate([
        { $match: { product: { $in: ids } } },
        { $group: { _id: '$product', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      const idToReview = new Map(reviewAgg.map(r => [String(r._id), { avg: r.avgRating || 0, count: r.count || 0 }]));

      return {
        ...section.toObject(),
        products: products.map(p => {
          const base = p.productId.toObject();
          const rec = idToReview.get(String(base._id));
          const rating = rec ? Number(rec.avg) : (typeof base.rating === 'number' ? base.rating : 0);
          const reviewsCount = rec ? Number(rec.count) : (typeof base.reviewsCount === 'number' ? base.reviewsCount : 0);
          return {
            ...base,
            order: p.order,
            rating,
            reviewsCount,
          };
        })
      };
    }));

    console.log('Homepage: Returning processed sections');
    res.json({ success: true, data: processedSections });
  } catch (error) {
    console.error('Homepage: Error fetching public sections:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Public: Get products for a specific homepage section with pagination
router.get('/sections/:name/products/public', async (req, res) => {
  try {
    const { name } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const section = await HomePageSection.findOne({ name }).lean();
    if (!section || !section.isActive) {
      return res.status(404).json({ success: false, message: 'Section not found or inactive' });
    }

    const baseFilters = { enabled: true, status: { $ne: 'rejected' } };
    let filters = { ...baseFilters };
    let sort = { createdAt: -1 };
    // If admin curated products exist for this section, honor that list even if type is auto
    const curated = Array.isArray(section.products) ? section.products.filter(p => p && p.productId).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    if (curated.length > 0) {
      const total = curated.length;
      const slice = curated.slice((pageNum - 1) * perPage, (pageNum - 1) * perPage + perPage);
      const ids = slice.map(p => p.productId).filter(Boolean);
      const found = await Product.find({ _id: { $in: ids }, ...baseFilters })
        .select('name images regularPrice specialPrice rating reviewsCount reviews')
        .lean();
      // Preserve curated order
      const mapById = new Map(found.map(p => [String(p._id), p]));
      const orderedItems = ids.map(id => mapById.get(String(id))).filter(Boolean).map(p => ({
        ...p,
        reviewsCount: typeof p.reviewsCount === 'number' ? p.reviewsCount : (Array.isArray(p.reviews) ? p.reviews.length : 0),
      }));
      return res.json({ success: true, data: orderedItems, meta: { total, page: pageNum, limit: perPage } });
    }

    switch (section.type) {
      case 'auto-popular':
        // Prefer products with salesCount first, then featured, then recents
        sort = { salesCount: -1, featured: -1, createdAt: -1 };
        break;
      case 'auto-recent': {
        const daysBack = section.autoSettings?.daysBack || 30;
        const dateLimit = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
        filters.createdAt = { $gte: dateLimit };
        sort = { createdAt: -1 };
        break;
      }
      case 'auto-category':
        if (section.autoSettings?.categoryId) {
          filters.category = section.autoSettings.categoryId;
        }
        sort = { createdAt: -1 };
        break;
      case 'auto-rating':
        sort = { rating: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const [items, total] = await Promise.all([
      Product.find(filters)
        .select('name images regularPrice specialPrice rating reviewsCount reviews')
        .sort(sort)
        .skip((pageNum - 1) * perPage)
        .limit(perPage)
        .lean(),
      Product.countDocuments(filters)
    ]);

    const normalized = items.map(p => ({
      ...p,
      reviewsCount: typeof p.reviewsCount === 'number' ? p.reviewsCount : (Array.isArray(p.reviews) ? p.reviews.length : 0),
    }));

    return res.json({ success: true, data: normalized, meta: { total, page: pageNum, limit: perPage } });
  } catch (error) {
    console.error('Homepage: section products error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to fetch section products' });
  }
});

// Create new section
router.post('/sections', authenticate, requireAdmin, async (req, res) => {
  try {
    const section = new HomePageSection(req.body);
    await section.save();
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update section
router.put('/sections/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const section = await HomePageSection.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, data: section });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete section
router.delete('/sections/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const section = await HomePageSection.findByIdAndDelete(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add product to section
router.post('/sections/:id/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const { productId, order } = req.body;
    const section = await HomePageSection.findById(req.params.id);
    
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    // Check if product already exists
    const exists = section.products.find(p => p.productId.toString() === productId);
    if (exists) {
      return res.status(400).json({ success: false, message: 'Product already in section' });
    }

    section.products.push({ productId, order: order || section.products.length });
    await section.save();
    
    const populatedSection = await HomePageSection.findById(req.params.id)
      .populate('products.productId', 'name price images rating salesCount');
    
    res.json({ success: true, data: populatedSection });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Remove product from section
router.delete('/sections/:id/products/:productId', authenticate, requireAdmin, async (req, res) => {
  try {
    const section = await HomePageSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    section.products = section.products.filter(
      p => p.productId.toString() !== req.params.productId
    );
    await section.save();
    
    res.json({ success: true, message: 'Product removed from section' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reorder products in section
router.patch('/sections/:id/products/reorder', authenticate, requireAdmin, async (req, res) => {
  try {
    const { productOrders } = req.body; // [{ productId, order }]
    const section = await HomePageSection.findById(req.params.id);
    
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    productOrders.forEach(({ productId, order }) => {
      const product = section.products.find(p => p.productId.toString() === productId);
      if (product) {
        product.order = order;
      }
    });

    await section.save();
    res.json({ success: true, message: 'Products reordered successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Helper function to get auto-generated products
async function getAutoProducts(section) {
  const query = { status: 'approved', enabled: true };
  
  console.log(`getAutoProducts: Getting products for section "${section.name}" (type: ${section.type})`);
  
  switch (section.type) {
    case 'auto-popular':
      // Try multiple strategies to get popular products
      let products = [];
      
      // Strategy 1: Try to get products with salesCount > 0
      products = await Product.find({ ...query, salesCount: { $gt: 0 } })
        .sort({ salesCount: -1, createdAt: -1 })
        .limit(section.settings.maxProducts);
      
      console.log(`getAutoProducts: Strategy 1 (salesCount > 0) found ${products.length} products`);
      
      // Strategy 2: If not enough, add featured products
      if (products.length < section.settings.maxProducts) {
        const featuredProducts = await Product.find({ ...query, featured: true })
          .sort({ createdAt: -1 })
          .limit(section.settings.maxProducts - products.length);
        
        console.log(`getAutoProducts: Strategy 2 (featured) found ${featuredProducts.length} products`);
        
        const existingIds = products.map(p => p._id.toString());
        const newFeatured = featuredProducts.filter(p => !existingIds.includes(p._id.toString()));
        products = [...products, ...newFeatured];
      }
      
      // Strategy 3: If still not enough, add recent products
      if (products.length < section.settings.maxProducts) {
        const recentProducts = await Product.find(query)
          .sort({ createdAt: -1 })
          .limit(section.settings.maxProducts - products.length);
        
        console.log(`getAutoProducts: Strategy 3 (recent) found ${recentProducts.length} products`);
        
        const existingIds = products.map(p => p._id.toString());
        const newRecent = recentProducts.filter(p => !existingIds.includes(p._id.toString()));
        products = [...products, ...newRecent];
      }
      
      console.log(`getAutoProducts: Final result for "${section.name}": ${products.length} products`);
      return products;
    
    case 'auto-recent':
      const daysBack = section.autoSettings.daysBack || 30;
      const dateLimit = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: dateLimit };
      const recentProducts = await Product.find(query).sort({ createdAt: -1 }).limit(section.settings.maxProducts);
      console.log(`getAutoProducts: auto-recent found ${recentProducts.length} products (daysBack: ${daysBack})`);
      return recentProducts;
    
    case 'auto-category':
      if (section.autoSettings.categoryId) {
        query.category = section.autoSettings.categoryId;
      }
      const categoryProducts = await Product.find(query).sort({ createdAt: -1 }).limit(section.settings.maxProducts);
      console.log(`getAutoProducts: auto-category found ${categoryProducts.length} products`);
      return categoryProducts;
    
    case 'auto-rating':
      // Try to get products with rating > 0, fallback to featured and recent
      let ratedProducts = await Product.find({ ...query, rating: { $gt: 0 } })
        .sort({ rating: -1, createdAt: -1 })
        .limit(section.settings.maxProducts);
      
      console.log(`getAutoProducts: auto-rating found ${ratedProducts.length} products with rating > 0`);
      
      if (ratedProducts.length < section.settings.maxProducts) {
        const fallbackProducts = await Product.find(query)
          .sort({ featured: -1, createdAt: -1 })
          .limit(section.settings.maxProducts - ratedProducts.length);
        
        console.log(`getAutoProducts: auto-rating fallback found ${fallbackProducts.length} products`);
        
        const existingIds = ratedProducts.map(p => p._id.toString());
        const newProducts = fallbackProducts.filter(p => !existingIds.includes(p._id.toString()));
        ratedProducts = [...ratedProducts, ...newProducts];
      }
      
      console.log(`getAutoProducts: auto-rating final result: ${ratedProducts.length} products`);
      return ratedProducts;
    
    default:
      // Fallback: just get any approved products
      const fallbackProducts = await Product.find(query).sort({ createdAt: -1 }).limit(section.settings.maxProducts);
      console.log(`getAutoProducts: default fallback found ${fallbackProducts.length} products`);
      return fallbackProducts;
  }
}

module.exports = router;