const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    enabled: { type: Boolean, default: true, index: true },
    balance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    commission: { type: Number, default: 10 },
    logo: { type: String, default: '' },
    logoPublicId: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);