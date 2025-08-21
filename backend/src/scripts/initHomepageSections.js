const mongoose = require('mongoose');
const HomePageSection = require('../models/HomePageSection');

const defaultSections = [
  {
    name: 'most-popular',
    title: 'Most Popular',
    subtitle: 'Trending products everyone loves',
    isActive: true,
    order: 1,
    type: 'auto-popular',
    settings: {
      maxProducts: 10,
      showPrice: true,
      showRating: true,
      layout: 'horizontal',
      showTags: true
    },
    autoSettings: {
      minSales: 5,
      minRating: 0,
      daysBack: 30
    }
  },
  {
    name: 'best-seller',
    title: 'Best Sellers',
    subtitle: 'Top performing products',
    isActive: true,
    order: 2,
    type: 'auto-popular',
    settings: {
      maxProducts: 8,
      showPrice: true,
      showRating: true,
      layout: 'horizontal',
      showTags: true
    },
    autoSettings: {
      minSales: 10,
      minRating: 0,
      daysBack: 60
    }
  },
  {
    name: 'just-for-you',
    title: 'Just For You',
    subtitle: 'Personalized recommendations',
    isActive: true,
    order: 3,
    type: 'auto-recent',
    settings: {
      maxProducts: 12,
      showPrice: true,
      showRating: true,
      layout: 'grid',
      showTags: true
    },
    autoSettings: {
      minRating: 0,
      daysBack: 7
    }
  },
  {
    name: 'new-arrivals',
    title: 'New Arrivals',
    subtitle: 'Fresh products just added',
    isActive: true,
    order: 4,
    type: 'auto-recent',
    settings: {
      maxProducts: 6,
      showPrice: true,
      showRating: false,
      layout: 'horizontal',
      showTags: true
    },
    autoSettings: {
      minRating: 0,
      daysBack: 14
    }
  }
];

async function initHomepageSections() {
  try {
    console.log('Initializing homepage sections...');
    
    for (const section of defaultSections) {
      const existing = await HomePageSection.findOne({ name: section.name });
      if (!existing) {
        await HomePageSection.create(section);
        console.log(`Created section: ${section.title}`);
      } else {
        console.log(`Section already exists: ${section.title}`);
      }
    }
    
    console.log('Homepage sections initialization completed!');
  } catch (error) {
    console.error('Error initializing homepage sections:', error);
  }
}

// Run if called directly
if (require.main === module) {
  // Connect to MongoDB
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eshop';
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      return initHomepageSections();
    })
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { initHomepageSections };