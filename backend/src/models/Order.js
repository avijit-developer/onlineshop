const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
	product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
	name: { type: String, required: true },
	sku: { type: String },
	price: { type: Number, required: true },
	quantity: { type: Number, required: true, min: 1 },
	image: { type: String },
	selectedAttributes: { type: Map, of: String, default: {} },
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
	subtotal: { type: Number, required: true },
	total: { type: Number, required: true },
	statusHistory: [statusHistorySchema],
}, { timestamps: true });

orderSchema.statics.generateOrderNumber = async function() {
	const ts = Date.now();
	return `ORD-${ts}`;
};

module.exports = mongoose.model('Order', orderSchema);