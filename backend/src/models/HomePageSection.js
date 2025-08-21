const mongoose = require('mongoose');

const homePageSectionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    enum: ['most-popular', 'best-seller', 'just-for-you', 'new-arrivals', 'trending']
  },
  title: { type: String, required: true },
  subtitle: String,
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  type: { 
    type: String, 
    enum: ['manual', 'auto-popular', 'auto-recent', 'auto-category', 'auto-rating'],
    default: 'manual'
  },
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    order: { type: Number, default: 0 },
    addedAt: { type: Date, default: Date.now }
  }],
  settings: {
    maxProducts: { type: Number, default: 10 },
    showPrice: { type: Boolean, default: true },
    showRating: { type: Boolean, default: true },
    layout: { type: String, enum: ['horizontal', 'grid', 'list'], default: 'horizontal' },
    showTags: { type: Boolean, default: true }
  },
  autoSettings: {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    minRating: { type: Number, default: 0 },
    minSales: { type: Number, default: 0 },
    daysBack: { type: Number, default: 30 }
  }
}, { timestamps: true });

module.exports = mongoose.model('HomePageSection', homePageSectionSchema);