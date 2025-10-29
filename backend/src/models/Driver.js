const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    phone: { type: String, required: true, trim: true },
    address1: { type: String, trim: true },
    address2: { type: String, trim: true },
    city: { type: String, trim: true },
    zip: { type: String, trim: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    enabled: { type: Boolean, default: true, index: true },
    balance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    avatar: { type: String, default: '' },
    avatarPublicId: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Driver', driverSchema);


