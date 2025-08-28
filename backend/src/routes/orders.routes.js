const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { authenticate, requireRole, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper to compute totals
function computeTotals(items, taxPercent = 0, shippingCost = 0, discountAmount = 0) {
	const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
	const taxAmount = (subtotal * Number(taxPercent || 0)) / 100;
	const totalBeforeDiscount = subtotal + taxAmount + Number(shippingCost || 0);
	const total = Math.max(0, totalBeforeDiscount - Number(discountAmount || 0));
	return { subtotal, total };
}

// Customer: create order (uses provided items or cart)
router.post('/me', authenticate, requireRole(['customer']), async (req, res) => {
	try {
		const { items: bodyItems, shippingAddress, paymentMethod = 'cod', tax = 0, shippingCost = 0, couponCode, orderNote } = req.body || {};
		if (!shippingAddress) {
			return res.status(400).json({ success: false, message: 'shippingAddress is required' });
		}
		let items = bodyItems;
		if (!Array.isArray(items) || items.length === 0) {
			// fall back to cart items
			const cart = await Cart.findOne({ user: req.user.id }).lean();
			items = (cart?.items || []).map(ci => ({
				product: ci.product,
				name: ci.product?.name || 'Product',
				sku: ci.variantInfo?.sku || ci.product?.sku || '',
				price: ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? ci.product?.specialPrice ?? ci.product?.regularPrice ?? 0,
				quantity: ci.quantity,
				image: (ci.variantInfo?.images && ci.variantInfo.images[0]) || (Array.isArray(ci.images) && ci.images[0]) || null,
				selectedAttributes: ci.selectedAttributes || {},
			}));
		}
		if (!Array.isArray(items) || items.length === 0) {
			return res.status(400).json({ success: false, message: 'No items to place order' });
		}
		// Compute discount via coupon if provided
		let discountAmount = 0; let appliedCouponCode = null;
		if (couponCode) {
			try {
				const Coupon = require('../models/Coupon');
				const now = new Date();
				const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase(), isActive: true, startDate: { $lte: now }, endDate: { $gte: now } }).lean();
				if (coupon) {
					const sub = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
					if (coupon.discountType === 'percentage') {
						discountAmount = (sub * Number(coupon.discountValue || 0)) / 100;
						if (coupon.maximumDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
					} else {
						discountAmount = Number(coupon.discountValue || 0);
					}
					appliedCouponCode = coupon.code;
				}
			} catch (_) {}
		}
		const { subtotal, total } = computeTotals(items, tax, shippingCost, discountAmount);
		const orderNumber = await Order.generateOrderNumber();
		const order = await Order.create({
			user: req.user.id,
			orderNumber,
			status: 'confirmed',
			items,
			shippingAddress,
			paymentMethod,
			tax,
			shippingCost,
			discountAmount,
			couponCode: appliedCouponCode,
			subtotal,
			total,
			orderNote: orderNote || '',
			statusHistory: [{ status: 'confirmed', updatedBy: 'system' }],
		});
		// Clear cart after order
		const cart = await Cart.findOne({ user: req.user.id });
		if (cart) { cart.clearCart(); await cart.save(); }
		res.status(201).json({ success: true, data: order });
	} catch (err) {
		console.error('Create order error:', err);
		res.status(500).json({ success: false, message: 'Failed to create order' });
	}
});

// Customer: list my orders
router.get('/me', authenticate, requireRole(['customer']), async (req, res) => {
	try {
		const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
		res.json({ success: true, data: orders });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to get orders' });
	}
});

// Customer: get order by id (if owner)
router.get('/me/:id', authenticate, requireRole(['customer']), async (req, res) => {
	try {
		const order = await Order.findOne({ _id: req.params.id, user: req.user.id }).lean();
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		res.json({ success: true, data: order });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to get order' });
	}
});

// Admin: list all orders
router.get('/', authenticate, requireAdmin, async (req, res) => {
	try {
		const { page = 1, limit = 20 } = req.query;
		const p = Math.max(parseInt(page, 10) || 1, 1);
		const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
		const [items, total] = await Promise.all([
			Order.find({}).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email').lean(),
			Order.countDocuments({})
		]);
		res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to list orders' });
	}
});

// Admin: update order status
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
	try {
		const { status } = req.body || {};
		if (!status) return res.status(400).json({ success: false, message: 'status is required' });
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		order.status = status;
		order.statusHistory.push({ status, updatedBy: req.user?.name || 'admin' });
		await order.save();
		res.json({ success: true, data: order });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to update status' });
	}
});

// Admin: delete order
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
	try {
		const deleted = await Order.findByIdAndDelete(req.params.id).lean();
		if (!deleted) return res.status(404).json({ success: false, message: 'Order not found' });
		res.json({ success: true, message: 'Order deleted' });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to delete order' });
	}
});

module.exports = router;