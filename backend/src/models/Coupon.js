const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minimumAmount: { type: Number, default: 0 },
    maximumDiscount: { type: Number, default: null },
    usageLimit: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, default: 0 },
    // New: limit per user (e.g., one-time use per user)
    perUserLimit: { type: Number, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true, index: true },
    appliesTo: { type: String, enum: ['all', 'category', 'vendor', 'product', 'new_user'], default: 'all' },
    vendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    // New: free shipping toggle
    freeShipping: { type: Boolean, default: false },
    // New: restrict to payment methods (e.g., ['paytm', 'upi', 'card', 'cod'])
    allowedPaymentMethods: { type: [String], default: [] },
    // New: BOGO rule configuration
    ruleType: { type: String, enum: ['standard', 'bogo'], default: 'standard' },
    bogoBuyProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    bogoGetProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    bogoBuyQty: { type: Number, default: 1, min: 1 },
    bogoGetQty: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1, endDate: 1 });

module.exports = mongoose.model('Coupon', couponSchema);

// Ensure arrays are unique ObjectIds on save and update
function normalizeIdArray(arr) {
  if (!Array.isArray(arr)) return [];
  const set = new Set(arr.map(v => String(v)));
  return Array.from(set).map(id => new mongoose.Types.ObjectId(id));
}

couponSchema.pre('save', function(next) {
  this.vendorIds = normalizeIdArray(this.vendorIds);
  this.categoryIds = normalizeIdArray(this.categoryIds);
  this.productIds = normalizeIdArray(this.productIds);
  this.bogoBuyProductIds = normalizeIdArray(this.bogoBuyProductIds);
  this.bogoGetProductIds = normalizeIdArray(this.bogoGetProductIds);
  next();
});

couponSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  if (update.vendorIds) update.vendorIds = normalizeIdArray(update.vendorIds);
  if (update.categoryIds) update.categoryIds = normalizeIdArray(update.categoryIds);
  if (update.productIds) update.productIds = normalizeIdArray(update.productIds);
  if (update.bogoBuyProductIds) update.bogoBuyProductIds = normalizeIdArray(update.bogoBuyProductIds);
  if (update.bogoGetProductIds) update.bogoGetProductIds = normalizeIdArray(update.bogoGetProductIds);
  this.setUpdate(update);
  next();
});

