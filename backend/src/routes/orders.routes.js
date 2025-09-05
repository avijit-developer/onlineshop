const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { authenticate, requireRole, requireAdmin } = require('../middleware/auth');
const Vendor = require('../models/Vendor');

const router = express.Router();
const { sendMail } = require('../utils/mailer');
const { validateAndComputeCoupon } = require('../utils/coupons');

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
		// Enrich items with vendor and compute commission
		try {
			const ids = items.map(i => i.product).filter(Boolean);
			const prods = await Product.find({ _id: { $in: ids } }).select('_id vendor').lean();
			const idToVendor = new Map(prods.map(p => [String(p._id), String(p.vendor)]));
			const vendorIds = Array.from(new Set(prods.map(p => String(p.vendor))));
			const Vendor = require('../models/Vendor');
			const vendorDocs = await Vendor.find({ _id: { $in: vendorIds } }).select('_id commission').lean();
			const idToCommission = new Map(vendorDocs.map(v => [String(v._id), Number(v.commission || 0)]));
			items = items.map(i => {
				const vendorId = idToVendor.get(String(i.product));
				const commissionRate = idToCommission.get(String(vendorId)) || 0;
				const lineTotal = Number(i.price || 0) * Number(i.quantity || 0);
				const commissionAmount = (lineTotal * commissionRate) / 100;
				return { ...i, vendor: vendorId, commissionRate, commissionAmount };
			});
		} catch (_) {}
		// Compute discount via coupon if provided (enforce rules and free shipping/payment method)
		let discountAmount = 0; let appliedCouponCode = null; let effectiveShippingCost = Number(shippingCost || 0);
		if (couponCode) {
			const result = await validateAndComputeCoupon({ couponCode, items, userId: req.user.id, paymentMethod });
			if (result.valid) {
				discountAmount = Number(result.discountAmount || 0);
				appliedCouponCode = String(couponCode).toUpperCase();
				if (result.freeShipping) {
					effectiveShippingCost = 0;
				}
			}
		}
		const { subtotal, total } = computeTotals(items, tax, effectiveShippingCost, discountAmount);
		const orderNumber = await Order.generateOrderNumber();
		// Pull customer phone for admin display
		let customerPhone = '';
		try {
			const u = await User.findById(req.user.id).select('phone').lean();
			customerPhone = u?.phone || '';
		} catch (_) {}

		const order = await Order.create({
			user: req.user.id,
			orderNumber,
			status: 'confirmed',
			items,
			shippingAddress,
			paymentMethod,
			tax,
			shippingCost: effectiveShippingCost,
			discountAmount,
			couponCode: appliedCouponCode,
			subtotal,
			total,
			orderNote: orderNote || '',
			customerPhone,
			statusHistory: [{ status: 'confirmed', updatedBy: 'system' }],
		});
		// Increment coupon usage if applied
		if (appliedCouponCode) {
			try {
				const Coupon = require('../models/Coupon');
				await Coupon.updateOne({ code: appliedCouponCode }, { $inc: { usedCount: 1 } });
			} catch (_) {}
		}
		// Clear cart after order and reset any coupon state
		const cart = await Cart.findOne({ user: req.user.id });
		if (cart) {
			cart.clearCart();
			cart.couponCode = null;
			cart.couponDiscount = 0;
			cart.freeShippingApplied = false;
			await cart.save();
		}
		// Send order placed email to customer (best-effort)
		try {
			const u = await User.findById(req.user.id).select('email name').lean();
			const to = u?.email;
			if (to) {
				const itemsHtml = (items || []).map(it => `<li>${it.name} x ${it.quantity} — ₹${Number(it.price||0).toFixed(2)}</li>`).join('');
				await sendMail({
					to,
					subject: `Order Placed - ${orderNumber}`,
					html: `<p>Hi ${u?.name || ''},</p><p>Thanks for your order <b>${orderNumber}</b>.</p><ul>${itemsHtml}</ul><p>Total: <b>₹${total.toFixed(2)}</b></p>`
				});
			}
		} catch (_) {}
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
		const [orders, total] = await Promise.all([
			Order.find({}).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email phone').lean(),
			Order.countDocuments({})
		]);
		try {
			const missingIds = new Set();
			for (const o of orders) {
				for (const it of (o.items || [])) {
					if (!it.vendor && it.product) missingIds.add(String(it.product));
				}
			}
			if (missingIds.size > 0) {
				const prods = await Product.find({ _id: { $in: Array.from(missingIds) } }).select('_id vendor').lean();
				const map = new Map(prods.map(p => [String(p._id), String(p.vendor)]));
				for (const o of orders) {
					for (const it of (o.items || [])) {
						if (!it.vendor && it.product) {
							const v = map.get(String(it.product));
							if (v) it.vendor = v;
						}
					}
				}
			}
		} catch (_) {}
		res.json({ success: true, data: orders, meta: { total, page: p, limit: l } });
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
		// Notify customer
		try {
			const u = await User.findById(order.user).select('email name').lean();
			if (u?.email) {
				await sendMail({
					to: u.email,
					subject: `Your order ${order.orderNumber} is now ${status}`,
					html: `<p>Hi ${u?.name || ''},</p><p>Your order <b>${order.orderNumber}</b> status changed to <b>${status}</b>.</p>`
				});
			}
		} catch (_) {}
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
// Vendor user: list orders scoped to assigned vendors (items filtered)
router.get('/vendor', authenticate, requireRole(['vendor']), async (req, res) => {
    try {
        const vendorIds = Array.isArray(req.user.vendors) && req.user.vendors.length > 0
            ? req.user.vendors.map(String)
            : (req.user.vendorId ? [String(req.user.vendorId)] : []);
        if (vendorIds.length === 0) return res.json({ success: true, data: [], meta: { total: 0 } });

        const { page = 1, limit = 20 } = req.query;
        const p = Math.max(parseInt(page, 10) || 1, 1);
        const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        // Find orders that have at least one item for these vendors
        const query = { 'items.vendor': { $in: vendorIds } };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
            Order.countDocuments(query)
        ]);

        // For each order, filter items to only this vendor set and compute vendor totals
        const mapped = orders.map(o => {
            const vendorItems = (o.items || []).filter(it => vendorIds.includes(String(it.vendor)));
            const vendorSubtotal = vendorItems.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
            const vendorCommission = vendorItems.reduce((s, it) => s + Number(it.commissionAmount || 0), 0);
            const vendorNet = vendorSubtotal - vendorCommission;
            return {
                id: o._id,
                orderNumber: o.orderNumber,
                createdAt: o.createdAt,
                status: o.status,
                customer: { id: o.user },
                items: vendorItems,
                vendorItemCount: vendorItems.length,
                vendorSubtotal,
                vendorCommission,
                vendorNet
            };
        });

        res.json({ success: true, data: mapped, meta: { total, page: p, limit: l } });
    } catch (err) {
        console.error('Vendor orders error:', err);
        res.status(500).json({ success: false, message: 'Failed to list vendor orders' });
    }
});

// Vendor user: get a single order scoped to assigned vendors (items filtered)
router.get('/vendor/:id', authenticate, requireRole(['vendor']), async (req, res) => {
    try {
        const vendorIds = Array.isArray(req.user.vendors) && req.user.vendors.length > 0
            ? req.user.vendors.map(String)
            : (req.user.vendorId ? [String(req.user.vendorId)] : []);
        if (vendorIds.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found for vendor' });
        }

        const o = await Order.findById(req.params.id).populate('user', 'name email phone').lean();
        if (!o) return res.status(404).json({ success: false, message: 'Order not found' });

        const vendorItems = (o.items || []).filter(it => vendorIds.includes(String(it.vendor)));
        if (vendorItems.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found for vendor' });
        }

        const vendorSubtotal = vendorItems.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
        const vendorCommission = vendorItems.reduce((s, it) => s + Number(it.commissionAmount || 0), 0);
        const vendorNet = vendorSubtotal - vendorCommission;

        // Fetch vendor info for items involved in this order (usually one)
        const vendorIdsInOrder = Array.from(new Set(vendorItems.map(it => String(it.vendor)).filter(Boolean)));
        let vendorInfo = null;
        let vendorInfos = [];
        if (vendorIdsInOrder.length > 0) {
            try {
                const vdocs = await Vendor.find({ _id: { $in: vendorIdsInOrder } })
                    .select('_id companyName phone address address1 address2 city zip status enabled commission balance totalEarnings createdAt updatedAt')
                    .lean();
                vendorInfos = vdocs;
                if (vdocs.length === 1) vendorInfo = vdocs[0];
            } catch (_) {}
        }

        const data = {
            _id: o._id,
            orderNumber: o.orderNumber,
            status: o.status,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            user: o.user ? { _id: o.user._id || o.user, name: o.user.name, email: o.user.email, phone: o.user.phone } : undefined,
            shippingAddress: o.shippingAddress,
            paymentMethod: o.paymentMethod,
            tax: o.tax,
            shippingCost: o.shippingCost,
            discountAmount: o.discountAmount,
            couponCode: o.couponCode,
            subtotal: o.subtotal,
            total: o.total,
            orderNote: o.orderNote,
            statusHistory: o.statusHistory,
            items: vendorItems,
            vendorSubtotal,
            vendorCommission,
            vendorNet,
            vendorInfo,
            vendors: vendorInfos,
        };

        res.json({ success: true, data });
    } catch (err) {
        console.error('Vendor order by id error:', err);
        res.status(500).json({ success: false, message: 'Failed to get order' });
    }
});