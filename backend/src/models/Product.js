const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    attributes: { type: Map, of: String, default: {} },
    price: { type: Number },
    specialPrice: { type: Number },
    stock: { type: Number, default: 0 },
    sku: { type: String, trim: true },
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

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },

    sku: { type: String, trim: true, index: true },
    tags: { type: [String], default: [] },

    regularPrice: { type: Number, required: true, min: 0 },
    specialPrice: { type: Number, default: null },
    tax: { type: Number, default: 0 },

    stock: { type: Number, default: 0 },
    lowStockAlert: { type: Number, default: 0 },

    images: { type: [String], default: [] },
    imagePublicIds: { type: [String], default: [] },

    variants: { type: [variantSchema], default: [] },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    featured: { type: Boolean, default: false, index: true },
    enabled: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

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

module.exports = mongoose.model('Product', productSchema);