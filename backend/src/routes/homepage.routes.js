const express = require('express');
const HomePageSection = require('../models/HomePageSection');
const Product = require('../models/Product');
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
      .populate('products.productId', 'name price images rating salesCount')
      .sort({ order: 1 });
    
    res.json({ success: true, data: sections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get homepage sections (Public - for mobile app)
router.get('/sections/public', async (req, res) => {
  try {
    const sections = await HomePageSection.find({ isActive: true })
      .populate('products.productId', 'name price images rating salesCount status enabled')
      .sort({ order: 1 });

    // Filter out inactive products and populate auto-generated products
    const processedSections = await Promise.all(sections.map(async (section) => {
      let products = section.products
        .filter(p => p.productId && p.productId.status === 'approved' && p.productId.enabled)
        .sort((a, b) => a.order - b.order)
        .slice(0, section.settings.maxProducts);

      // If auto-type and not enough products, fetch more
      if (section.type !== 'manual' && products.length < section.settings.maxProducts) {
        const autoProducts = await getAutoProducts(section);
        const existingIds = products.map(p => p.productId._id.toString());
        const newProducts = autoProducts
          .filter(p => !existingIds.includes(p._id.toString()))
          .slice(0, section.settings.maxProducts - products.length);
        
        products = [...products, ...newProducts.map(p => ({ productId: p, order: 999 }))];
      }

      return {
        ...section.toObject(),
        products: products.map(p => ({
          ...p.productId.toObject(),
          order: p.order
        }))
      };
    }));

    res.json({ success: true, data: processedSections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
  
  switch (section.type) {
    case 'auto-popular':
      // Fallback: many schemas don't track salesCount. Prefer featured then recency.
      return await Product.find(query)
        .sort({ featured: -1, createdAt: -1 })
        .limit(section.settings.maxProducts);
    
    case 'auto-recent':
      const daysBack = section.autoSettings.daysBack || 30;
      const dateLimit = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: dateLimit };
      return await Product.find(query).sort({ createdAt: -1 }).limit(section.settings.maxProducts);
    
    case 'auto-category':
      if (section.autoSettings.categoryId) {
        query.category = section.autoSettings.categoryId;
      }
      return await Product.find(query).sort({ createdAt: -1 }).limit(section.settings.maxProducts);
    
    case 'auto-rating':
      // If rating not tracked, fallback to featured and recency as best proxy
      return await Product.find(query)
        .sort({ featured: -1, createdAt: -1 })
        .limit(section.settings.maxProducts);
    
    default:
      return [];
  }
}

module.exports = router;