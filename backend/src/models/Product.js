const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    attributes: { type: Map, of: String, default: {} },
    sku: { type: String, trim: true },
    price: { type: Number },
    specialPrice: { type: Number },
    stock: { type: Number, default: 0 },
    lowStockAlert: { type: Number, default: 10 },
    images: { type: [String], default: [] },
    imagePublicIds: { type: [String], default: [] }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true, index: true, unique: true },
    description: { type: String, trim: true },
    shortDescription: { type: String, trim: true },

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: false, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },

    sku: { type: String, trim: true },
    tags: { type: [String], default: [] },

    regularPrice: { type: Number, required: true, min: 0 },
    specialPrice: { type: Number, default: null },
    tax: { type: Number, default: 0 },

    stock: { type: Number, default: 0 },

    images: { type: [String], default: [] },
    imagePublicIds: { type: [String], default: [] },

    variants: { type: [variantSchema], default: [] },
    
    // New field: product type - 'simple' or 'configurable'
    productType: { type: String, enum: ['simple', 'configurable'], default: 'simple', index: true },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    featured: { type: Boolean, default: false, index: true },
    enabled: { type: Boolean, default: true, index: true },
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },
  { timestamps: true }
);

// Unique indexes for SKUs (ignore missing)
productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string' } } });
productSchema.index({ 'variants.sku': 1 }, { unique: true, partialFilterExpression: { 'variants.sku': { $type: 'string' } } });

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

productSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
  next();
});

// Ensure productType is always correct based on variants
productSchema.pre('save', function (next) {
  const hasVariants = this.variants && Array.isArray(this.variants) && this.variants.length > 0;
  const correctProductType = hasVariants ? 'configurable' : 'simple';
  
  if (this.productType !== correctProductType) {
    console.log(`Auto-correcting product "${this.name}" type from ${this.productType} to ${correctProductType} (variants: ${hasVariants ? this.variants.length : 0})`);
    this.productType = correctProductType;
  }
  
  next();
});

// Static method to check and fix product types
productSchema.statics.fixProductTypes = async function() {
  const products = await this.find({});
  let fixedCount = 0;
  
  for (const product of products) {
    const hasVariants = product.variants && Array.isArray(product.variants) && product.variants.length > 0;
    const correctProductType = hasVariants ? 'configurable' : 'simple';
    
    if (product.productType !== correctProductType) {
      product.productType = correctProductType;
      await product.save();
      fixedCount++;
      console.log(`Fixed product "${product.name}" type to ${correctProductType}`);
    }
  }
  
  return { total: products.length, fixed: fixedCount };
};

module.exports = mongoose.model('Product', productSchema);