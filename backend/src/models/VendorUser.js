const mongoose = require('mongoose');

const vendorUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['vendor'], default: 'vendor', index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: false, index: true }, // Keep for backward compatibility
    vendors: { type: [mongoose.Schema.Types.ObjectId], ref: 'Vendor', default: [], index: true }, // New multi-vendor support
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: false },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    tokenInvalidatedAt: { type: Date, default: null } // Track when tokens were invalidated
  },
  { timestamps: true }
);

module.exports = mongoose.model('VendorUser', vendorUserSchema);