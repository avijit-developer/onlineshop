const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    phone: { type: String, required: true, trim: true },
    // Granular address fields
    address1: { type: String, trim: true },
    address2: { type: String, trim: true },
    city: { type: String, trim: true },
    zip: { type: String, trim: true },
    // Legacy combined address
    address: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    enabled: { type: Boolean, default: true, index: true },
    balance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    commission: { type: Number, default: 10 },
    logo: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },
    // Bank details
    bankAccountHolderName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bankIFSC: { type: String, trim: true },
    bankBranch: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);