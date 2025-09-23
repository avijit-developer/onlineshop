const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String },
    // Effective price used for customer totals (admin price or special at order time)
    price: { type: Number, required: true },
    // Store both admin and vendor unit prices for reporting and vendor/admin views
    adminUnitPrice: { type: Number, default: null },
    adminUnitSpecialPrice: { type: Number, default: null },
    vendorUnitPrice: { type: Number, default: null },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
    selectedAttributes: { type: Map, of: String, default: {} },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    commissionRate: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
});

const statusHistorySchema = new mongoose.Schema({
	status: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
	updatedBy: { type: String, default: 'system' },
});

const orderSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	orderNumber: { type: String, required: true, unique: true },
	status: { type: String, enum: ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'], default: 'pending' },
	items: [orderItemSchema],
	shippingAddress: { type: String, required: true },
	paymentMethod: { type: String, required: true },
	tax: { type: Number, default: 0 },
	shippingCost: { type: Number, default: 0 },
	discountAmount: { type: Number, default: 0 },
	couponCode: { type: String, default: null },
	customerPhone: { type: String, default: '' },
	subtotal: { type: Number, required: true },
	total: { type: Number, required: true },
	orderNote: { type: String, default: '' },
	statusHistory: [statusHistorySchema],
	// Vendor-specific statuses
	vendorStatuses: { type: Map, of: String, default: {} },
	vendorStatusHistory: [{
		vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
		status: { type: String, required: true },
		timestamp: { type: Date, default: Date.now },
		updatedBy: { type: String, default: 'vendor' },
	}],
}, { timestamps: true });

orderSchema.statics.generateOrderNumber = async function() {
	const ts = Date.now();
	return `ORD-${ts}`;
};

module.exports = mongoose.model('Order', orderSchema);