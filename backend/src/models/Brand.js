const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true, index: true, unique: true },
    description: { type: String, trim: true },
    website: { type: String, trim: true },
    logo: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true }],
    featured: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 }
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

brandSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
  next();
});

module.exports = mongoose.model('Brand', brandSchema);