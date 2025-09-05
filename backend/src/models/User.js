const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phone: { type: String, trim: true },
    avatar: { type: String, trim: true },
    avatarPublicId: { type: String, trim: true },
    // Optional password hash enables customer login when present
    passwordHash: { type: String },
    resetOtp: { type: String, default: '' },
    resetOtpExpiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    // Address management
    addresses: [{
      label: { type: String, required: true, trim: true }, // e.g., "Home", "Work"
      name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, default: 'United States', trim: true },
      isDefault: { type: Boolean, default: false },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: undefined
        }
      }
    }],
    // Wishlist management
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);