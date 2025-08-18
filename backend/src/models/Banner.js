const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    image: { type: String, required: true },
    imagePublicId: { type: String, default: '' },
    linkUrl: { type: String, default: '' },
    linkText: { type: String, default: '' },
    position: { type: Number, default: 1, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    targetType: { type: String, enum: ['none','category','product','page'], default: 'none' },
    targetId: { type: String, default: '' },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Banner', bannerSchema);

