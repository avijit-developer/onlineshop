const mongoose = require('mongoose');

const driverUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['driver'], default: 'driver', index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: false, index: true },
    isActive: { type: Boolean, default: true },
    resetOtp: { type: String, default: '' },
    resetOtpExpiresAt: { type: Date, default: null },
    tokenInvalidatedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriverUser', driverUserSchema);


