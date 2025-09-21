const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { authenticate, requireRole, requireAdmin } = require('../middleware/auth');
const Vendor = require('../models/Vendor');

const router = express.Router();
const { sendMail, buildEmailHtml } = require('../utils/mailer');
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
                // Use admin prices for customer orders
                price: ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? ci.product?.specialPrice ?? ci.product?.regularPrice ?? 0,
                // Persist both admin and vendor unit prices for correct admin/vendor views
                adminUnitPrice: (ci.variantInfo?.price != null ? ci.variantInfo.price : (ci.product?.specialPrice != null ? ci.product.specialPrice : ci.product?.regularPrice ?? 0)),
                adminUnitSpecialPrice: (ci.variantInfo?.specialPrice != null ? ci.variantInfo.specialPrice : (ci.product?.specialPrice ?? null)),
                vendorUnitPrice: (ci.variantInfo?.vendorPrice != null ? ci.variantInfo.vendorPrice : (ci.product?.vendorSpecialPrice != null ? ci.product.vendorSpecialPrice : ci.product?.vendorRegularPrice ?? null)),
                vendorUnitSpecialPrice: (ci.variantInfo?.vendorSpecialPrice != null ? ci.variantInfo.vendorSpecialPrice : (ci.product?.vendorSpecialPrice ?? null)),
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
				const html = await buildEmailHtml({
					subject: `Order Placed - ${orderNumber}`,
					contentHtml: `<p>Hi ${u?.name || ''},</p><p>Thanks for your order <b>${orderNumber}</b>.</p><ul>${itemsHtml}</ul><p>Total: <b>₹${total.toFixed(2)}</b></p>`
				});
				await sendMail({ to, subject: `Order Placed - ${orderNumber}`, html });
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
		// Attach vendorSummaries for each order to support per-vendor display in apps
		const enhanced = [];
		for (const o of orders) {
			const orderSubtotal = Number(o.subtotal || 0);
			const taxPercent = Number(o.tax || 0);
			const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
			const vendorIds = Array.from(new Set((o.items || []).map(it => String(it.vendor)).filter(Boolean)));
			const summaries = vendorIds.map(vid => {
				const items = (o.items || []).filter(it => String(it.vendor) === String(vid));
				const vendorSubtotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
				const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
				const vendorStatus = (o.vendorStatuses && (o.vendorStatuses.get ? o.vendorStatuses.get(String(vid)) : o.vendorStatuses[String(vid)])) || o.status;
				return {
					vendor: vid,
					status: vendorStatus,
					items,
					vendorSubtotal,
					vendorTax: orderTaxAmount * share,
					vendorShipping: Number(o.shippingCost || 0) * share,
					vendorTotal: vendorSubtotal + (orderTaxAmount * share) + (Number(o.shippingCost || 0) * share),
				};
			});
			enhanced.push({ ...o, vendorSummaries: summaries });
		}
		res.json({ success: true, data: enhanced });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to get orders' });
	}
});

// Customer: get order by id (if owner)
router.get('/me/:id', authenticate, requireRole(['customer']), async (req, res) => {
	try {
		const order = await Order.findOne({ _id: req.params.id, user: req.user.id }).lean();
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		// Build vendor summaries for UI
		const vendorIds = Array.from(new Set((order.items || []).map(it => String(it.vendor)).filter(Boolean)));
		let vendors = [];
		try {
			const vdocs = await Vendor.find({ _id: { $in: vendorIds } }).select('_id companyName').lean();
			vendors = vdocs.map(v => ({ _id: v._id, name: v.companyName }));
		} catch (_) {}
		const orderSubtotal = Number(order.subtotal || 0);
		const taxPercent = Number(order.tax || 0);
		const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
		const summaries = vendorIds.map(vid => {
			const items = (order.items || []).filter(it => String(it.vendor) === String(vid));
			const vendorSubtotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
			const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
			return {
				vendor: vid,
				vendorName: (vendors.find(v => String(v._id) === String(vid))?.name) || 'Vendor',
				status: (order.vendorStatuses && (order.vendorStatuses.get ? order.vendorStatuses.get(String(vid)) : order.vendorStatuses[String(vid)])) || order.status,
				items,
				vendorSubtotal,
				vendorTax: orderTaxAmount * share,
				vendorShipping: Number(order.shippingCost || 0) * share,
				vendorTotal: vendorSubtotal + (orderTaxAmount * share) + (Number(order.shippingCost || 0) * share),
			};
		});
		res.json({ success: true, data: { ...order, vendorSummaries: summaries, vendors } });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to get order' });
	}
});

// Admin: list all orders
router.get('/', authenticate, requireAdmin, async (req, res) => {
	try {
		const { page = 1, limit = 20, userId } = req.query;
		const p = Math.max(parseInt(page, 10) || 1, 1);
		const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
		const query = {};
		if (userId) {
			query.user = userId;
		}
		const [orders, total] = await Promise.all([
			Order.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email phone').lean(),
			Order.countDocuments(query)
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

// Admin: summary for a specific user (total orders and total spent)
router.get('/summary', authenticate, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.json({ success: true, data: { totalOrders: 0, totalSpent: 0 } });
        }
        const results = await Order.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: { $toDouble: "$total" } } } }
        ]);
        const summary = results && results[0] ? { totalOrders: results[0].totalOrders || 0, totalSpent: results[0].totalSpent || 0 } : { totalOrders: 0, totalSpent: 0 };
        res.json({ success: true, data: summary });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to get order summary' });
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
				const itemsHtml = (order.items || []).map(it => `<tr><td>${it.name}</td><td>x ${it.quantity}</td><td>₹${Number(it.price||0).toFixed(2)}</td></tr>`).join('');
				const html = await buildEmailHtml({
					subject: `Your order ${order.orderNumber} is now ${status}`,
					contentHtml: `<p>Hi ${u?.name || ''},</p><p>Your order <b>${order.orderNumber}</b> status changed to <b>${status}</b>.</p>`,
					itemsTableHtml: `<thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemsHtml}</tbody>`,
					summaryRows: [
						{ key: 'Subtotal', value: `₹${Number(order.subtotal||0).toFixed(2)}` },
						{ key: `Tax (${Number(order.tax||0)}%)`, value: `₹${(Number(order.subtotal||0)*Number(order.tax||0)/100).toFixed(2)}` },
						{ key: 'Shipping', value: `₹${Number(order.shippingCost||0).toFixed(2)}` },
						...(Number(order.discountAmount||0) > 0 ? [{ key: 'Discount', value: `- ₹${Number(order.discountAmount||0).toFixed(2)}` }] : []),
						{ key: 'Total', value: `₹${Number(order.total||0).toFixed(2)}` }
					]
				});
				await sendMail({ to: u.email, subject: `Your order ${order.orderNumber} is now ${status}`, html });
			}
		} catch (_) {}
		// Notify vendor users with only their items (no order summary)
		try {
			const vendorIdsInOrder = Array.from(new Set((order.items || []).map(it => String(it.vendor)).filter(Boolean)));
			if (vendorIdsInOrder.length) {
				const VendorUser = require('../models/VendorUser');
				const vendorUsers = await VendorUser.find({
					$or: [
						{ vendor: { $in: vendorIdsInOrder } },
						{ vendors: { $in: vendorIdsInOrder } }
					],
					isActive: true
				}).select('email name vendor vendors').lean();

				const byVendor = new Map();
				for (const it of (order.items || [])) {
					const v = String(it.vendor || '');
					if (!v) continue;
					if (!byVendor.has(v)) byVendor.set(v, []);
					byVendor.get(v).push(it);
				}

				for (const vu of vendorUsers) {
					const v = String(vu.vendor || (Array.isArray(vu.vendors) && vu.vendors[0]) || '');
					if (!v) continue;
					const its = byVendor.get(v) || [];
					if (!vu.email || its.length === 0) continue;
					const itemsRows = its.map(it => `<tr><td>${it.name}</td><td>x ${it.quantity}</td><td>₹${Number(it.price||0).toFixed(2)}</td></tr>`).join('');
					const html = await buildEmailHtml({
						subject: `Order ${order.orderNumber} is now ${status}`,
						contentHtml: `<p>Dear ${vu.name || 'Vendor'},</p><p>Order <b>${order.orderNumber}</b> status changed to <b>${status}</b>.</p><p>Below are the items assigned to you.</p>`,
						itemsTableHtml: `<thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemsRows}</tbody>`
					});
					await sendMail({ to: vu.email, subject: `Order ${order.orderNumber} is now ${status}`, html });
				}
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

// Vendor: update order status (scoped to vendor's items). Sends customer email with only that vendor's items, without full summary.
router.patch('/vendor/:id/status', authenticate, requireRole(['vendor']), async (req, res) => {
    try {
        const { status } = req.body || {};
        if (!status) return res.status(400).json({ success: false, message: 'status is required' });

        const vendorIds = Array.isArray(req.user.vendors) && req.user.vendors.length > 0
            ? req.user.vendors.map(String)
            : (req.user.vendorId ? [String(req.user.vendorId)] : []);
        if (vendorIds.length === 0) return res.status(403).json({ success: false, message: 'No vendor access' });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // Check the order contains items for this vendor
        const vendorItems = (order.items || []).filter(it => vendorIds.includes(String(it.vendor)));
        if (vendorItems.length === 0) {
            return res.status(403).json({ success: false, message: 'Order does not contain your items' });
        }

        // Do not update global order status; only record vendor-specific status
        order.statusHistory.push({ status: `vendor:${status}`, updatedBy: req.user?.email || 'vendor' });
        // Record vendor-specific status
        try {
            const primaryVendorId = vendorIds[0];
            order.vendorStatuses = order.vendorStatuses || new Map();
            order.vendorStatuses.set(String(primaryVendorId), status);
            order.vendorStatusHistory = Array.isArray(order.vendorStatusHistory) ? order.vendorStatusHistory : [];
            order.vendorStatusHistory.push({ vendor: primaryVendorId, status, updatedBy: req.user?.email || 'vendor' });
        } catch (_) {}
        await order.save();

        // Build vendor-scoped response payload
        const primaryVendorId = vendorIds[0];
        const itemsScoped = (order.items || []).filter(it => String(it.vendor) === String(primaryVendorId));
        const vendorSubtotal = itemsScoped.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
        const orderSubtotal = Number(order.subtotal || 0);
        const taxPercent = Number(order.tax || 0);
        const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
        const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
        const vendorTaxShare = orderTaxAmount * share;
        const vendorShippingShare = Number(order.shippingCost || 0) * share;
        const vendorTotalShare = vendorSubtotal + vendorTaxShare + vendorShippingShare;
        const responseData = {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: status, // vendor-specific status just set
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            user: await User.findById(order.user).select('name email phone').lean().then(u => (u ? { _id: u._id, name: u.name, email: u.email, phone: u.phone } : undefined)).catch(() => undefined),
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            tax: order.tax,
            shippingCost: order.shippingCost,
            discountAmount: order.discountAmount,
            couponCode: order.couponCode,
            subtotal: order.subtotal,
            total: order.total,
            orderNote: order.orderNote,
            statusHistory: order.statusHistory,
            items: itemsScoped,
            vendorSubtotal,
            vendorTaxShare,
            vendorShippingShare,
            vendorTotalShare,
        };

        // Email customer with only vendor items (no full summary)
        try {
            const u = await User.findById(order.user).select('email name').lean();
            if (u?.email) {
                const itemsRows = itemsScoped.map(it => `<tr><td>${it.name}</td><td>x ${it.quantity}</td><td>₹${Number(it.price||0).toFixed(2)}</td></tr>`).join('');
                const html = await buildEmailHtml({
                    subject: `Your order ${order.orderNumber} is now ${status}`,
                    contentHtml: `<p>Hi ${u?.name || ''},</p><p>Your order <b>${order.orderNumber}</b> status changed to <b>${status}</b>.</p><p>Items from this vendor are listed below.</p>`,
                    itemsTableHtml: `<thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemsRows}</tbody>`
                    // No summary rows per requirement
                });
                await sendMail({ to: u.email, subject: `Your order ${order.orderNumber} is now ${status}`, html });
            }
        } catch (_) {}

        res.json({ success: true, data: responseData });
    } catch (err) {
        console.error('Vendor update status error:', err);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
});
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
            Order.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email phone').lean(),
            Order.countDocuments(query)
        ]);

        // For each order, filter items to only this vendor set and compute vendor totals
        const mapped = orders.map(o => {
            const vendorItems = (o.items || []).filter(it => vendorIds.includes(String(it.vendor)));
            const vendorSubtotal = vendorItems.reduce((s, it) => {
                const unit = (it.vendorUnitSpecialPrice != null) ? Number(it.vendorUnitSpecialPrice) : ((it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : Number(it.price || 0));
                return s + (unit * Number(it.quantity || 0));
            }, 0);
            const vendorCommission = vendorItems.reduce((s, it) => s + Number(it.commissionAmount || 0), 0);
            const vendorNet = vendorSubtotal - vendorCommission;
            const orderSubtotal = Number(o.subtotal || 0);
            const taxPercent = Number(o.tax || 0);
            const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
            const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
            const vendorTaxShare = orderTaxAmount * share;
            const vendorShippingShare = Number(o.shippingCost || 0) * share;
            const vendorTotalShare = vendorSubtotal + vendorTaxShare + vendorShippingShare;
            // Compute vendor-scoped status across vendors present in this order for this user
            const vendorIdsInOrder = Array.from(new Set(vendorItems.map(it => String(it.vendor)).filter(Boolean)));
            let vendorScopedStatus = o.status;
            try {
                const vsMap = o.vendorStatuses || {};
                const norm = (s) => {
                    const v = String(s || '').toLowerCase();
                    if (['cancelled','canceled'].includes(v)) return 'Cancelled';
                    if (['delivered','completed'].includes(v)) return 'Delivered';
                    if (['shipped','out_for_delivery','out-for-delivery','dispatched','in_transit'].includes(v)) return 'Shipped';
                    if (['confirmed'].includes(v)) return 'Confirmed';
                    if (['processing','packed','pending'].includes(v)) return 'Processing';
                    return 'Processing';
                };
                const statuses = vendorIdsInOrder.map(vid => norm(vsMap.get ? vsMap.get(vid) : vsMap[vid] || o.status));
                const uniq = Array.from(new Set(statuses));
                if (uniq.length === 1) vendorScopedStatus = uniq[0]; else {
                    const precedence = ['Cancelled','Delivered','Shipped','Processing','Confirmed','Pending'];
                    const top = precedence.find(p => uniq.includes(p)) || 'Processing';
                    vendorScopedStatus = `Partially ${top}`;
                }
            } catch (_) {}
            return {
                id: o._id,
                orderNumber: o.orderNumber,
                createdAt: o.createdAt,
                status: vendorScopedStatus,
                user: o.user ? { _id: o.user._id || o.user, name: o.user.name, email: o.user.email, phone: o.user.phone } : undefined,
                shippingAddress: o.shippingAddress,
                paymentMethod: o.paymentMethod,
                tax: o.tax,
                shippingCost: o.shippingCost,
                discountAmount: o.discountAmount,
                couponCode: o.couponCode,
                items: vendorItems,
                vendorItemCount: vendorItems.length,
                vendorSubtotal,
                vendorCommission,
                vendorNet,
                vendorTaxShare,
                vendorShippingShare,
                vendorTotalShare,
                // Aliases for frontends that expect these names
                vendorTax: vendorTaxShare,
                vendorShipping: vendorShippingShare,
                vendorTotal: vendorTotalShare
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

        const vendorSubtotal = vendorItems.reduce((s, it) => {
            const unit = (it.vendorUnitSpecialPrice != null) ? Number(it.vendorUnitSpecialPrice) : ((it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : Number(it.price || 0));
            return s + (unit * Number(it.quantity || 0));
        }, 0);
        const vendorCommission = vendorItems.reduce((s, it) => s + Number(it.commissionAmount || 0), 0);
        const vendorNet = vendorSubtotal - vendorCommission;
        const orderSubtotal = Number(o.subtotal || 0);
        const taxPercent = Number(o.tax || 0);
        const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
        const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
        const vendorTaxShare = orderTaxAmount * share;
        const vendorShippingShare = Number(o.shippingCost || 0) * share;
        const vendorTotalShare = vendorSubtotal + vendorTaxShare + vendorShippingShare;

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
            // Expose vendor-specific status if present, aggregated across this vendor's packages
            status: (() => {
                try {
                    const vsMap = o.vendorStatuses || {};
                    const norm = (s) => {
                        const v = String(s || '').toLowerCase();
                        if (['cancelled','canceled'].includes(v)) return 'Cancelled';
                        if (['delivered','completed'].includes(v)) return 'Delivered';
                        if (['shipped','out_for_delivery','out-for-delivery','dispatched','in_transit'].includes(v)) return 'Shipped';
                        if (['confirmed'].includes(v)) return 'Confirmed';
                        if (['processing','packed','pending'].includes(v)) return 'Processing';
                        return 'Processing';
                    };
                    const statuses = vendorIdsInOrder.map(vid => norm(vsMap.get ? vsMap.get(vid) : vsMap[vid] || o.status));
                    const uniq = Array.from(new Set(statuses));
                    if (uniq.length === 1) return uniq[0];
                    const precedence = ['Cancelled','Delivered','Shipped','Processing','Confirmed','Pending'];
                    const top = precedence.find(p => uniq.includes(p)) || 'Processing';
                    return `Partially ${top}`;
                } catch (_) { return o.status; }
            })(),
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
            vendorTaxShare,
            vendorShippingShare,
            vendorTotalShare,
            vendorInfo,
            vendors: vendorInfos,
        };

        res.json({ success: true, data });
    } catch (err) {
        console.error('Vendor order by id error:', err);
        res.status(500).json({ success: false, message: 'Failed to get order' });
    }
});