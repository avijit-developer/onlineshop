const mongoose = require('mongoose');

const driverPayoutSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: 'Manual' },
    note: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriverPayout', driverPayoutSchema);
