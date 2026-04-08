const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { authenticate, requireRole, requireAdmin } = require('../middleware/auth');
const Driver = require('../models/Driver');
const Vendor = require('../models/Vendor');
const Settings = require('../models/Settings');
const PDFDocument = require('pdfkit');

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

// Helper to reduce stock for order items
async function reduceStockForOrderItems(items) {
	try {
		const productIds = Array.from(new Set(items.map(it => String(it.product)).filter(Boolean)));
		if (productIds.length === 0) return;

		const products = await Product.find({ _id: { $in: productIds } }).lean();
		const idToProduct = new Map(products.map(p => [String(p._id), p]));

		for (const item of items) {
			const productId = String(item.product);
			const product = idToProduct.get(productId);
			if (!product) continue;

			const quantity = Number(item.quantity || 0);
			if (quantity <= 0) continue;

			const sku = String(item.sku || '').trim();
			const selectedAttributes = item.selectedAttributes || {};

			// Check if product has variants
			const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

			if (hasVariants) {
				// Find variant by SKU first, then by attributes
				let variant = null;
				if (sku) {
					const targetSku = sku.toLowerCase();
					variant = product.variants.find(v => String(v.sku || '').trim().toLowerCase() === targetSku);
				}
				
				if (!variant && selectedAttributes && Object.keys(selectedAttributes).length > 0) {
					variant = product.variants.find(v => {
						let vAttrs = {};
						try {
							if (v.attributes && typeof v.attributes.toJSON === 'function') vAttrs = v.attributes.toJSON();
							else if (v.attributes && typeof v.attributes.get === 'function') {
								try { vAttrs = Object.fromEntries(v.attributes); } catch (_) { vAttrs = {}; }
							}
							else vAttrs = v.attributes || {};
						} catch (_) { vAttrs = v.attributes || {}; }
						
						return Object.keys(selectedAttributes).every(k => String(vAttrs[k]) === String(selectedAttributes[k]));
					});
				}

				if (variant) {
					// Update variant stock
					const currentStock = Number(variant.stock || 0);
					const newStock = Math.max(0, currentStock - quantity);
					
					await Product.updateOne(
						{ _id: product._id, 'variants.sku': variant.sku },
						{ $set: { 'variants.$.stock': newStock } }
					);
				}
			} else {
				// Simple product - update product stock
				const currentStock = Number(product.stock || 0);
				const newStock = Math.max(0, currentStock - quantity);
				
				await Product.updateOne(
					{ _id: product._id },
					{ $set: { stock: newStock } }
				);
			}
		}
	} catch (error) {
		console.error('Error reducing stock:', error);
		// Don't throw - stock reduction failure shouldn't prevent order creation
	}
}

// Helper to restore stock for order items
async function restoreStockForOrderItems(items) {
	try {
		const productIds = Array.from(new Set(items.map(it => String(it.product)).filter(Boolean)));
		if (productIds.length === 0) return;

		const products = await Product.find({ _id: { $in: productIds } }).lean();
		const idToProduct = new Map(products.map(p => [String(p._id), p]));

		for (const item of items) {
			const productId = String(item.product);
			const product = idToProduct.get(productId);
			if (!product) continue;

			const quantity = Number(item.quantity || 0);
			if (quantity <= 0) continue;

			const sku = String(item.sku || '').trim();
			const selectedAttributes = item.selectedAttributes || {};

			// Check if product has variants
			const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

			if (hasVariants) {
				// Find variant by SKU first, then by attributes
				let variant = null;
				if (sku) {
					const targetSku = sku.toLowerCase();
					variant = product.variants.find(v => String(v.sku || '').trim().toLowerCase() === targetSku);
				}
				
				if (!variant && selectedAttributes && Object.keys(selectedAttributes).length > 0) {
					variant = product.variants.find(v => {
						let vAttrs = {};
						try {
							if (v.attributes && typeof v.attributes.toJSON === 'function') vAttrs = v.attributes.toJSON();
							else if (v.attributes && typeof v.attributes.get === 'function') {
								try { vAttrs = Object.fromEntries(v.attributes); } catch (_) { vAttrs = {}; }
							}
							else vAttrs = v.attributes || {};
						} catch (_) { vAttrs = v.attributes || {}; }
						
						return Object.keys(selectedAttributes).every(k => String(vAttrs[k]) === String(selectedAttributes[k]));
					});
				}

				if (variant) {
					// Restore variant stock
					const currentStock = Number(variant.stock || 0);
					const newStock = currentStock + quantity;
					
					await Product.updateOne(
						{ _id: product._id, 'variants.sku': variant.sku },
						{ $set: { 'variants.$.stock': newStock } }
					);
				}
			} else {
				// Simple product - restore product stock
				const currentStock = Number(product.stock || 0);
				const newStock = currentStock + quantity;
				
				await Product.updateOne(
					{ _id: product._id },
					{ $set: { stock: newStock } }
				);
			}
		}
	} catch (error) {
		console.error('Error restoring stock:', error);
		// Don't throw - stock restoration failure shouldn't prevent order cancellation
	}
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371; // Earth's radius in kilometers
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c; // Distance in kilometers
}

function buildActiveDriverOrderQuery(driverId, excludeOrderId) {
	const query = {
		driver: driverId,
		status: { $nin: ['delivered', 'cancelled', 'canceled', 'refunded'] },
		driverStatus: { $nin: ['delivered', 'delivery_completed'] },
	};
	if (excludeOrderId) {
		query._id = { $ne: excludeOrderId };
	}
	return query;
}

function isTerminalOrderStatus(orderOrStatus, driverStatusArg = null) {
	const status = typeof orderOrStatus === 'object' && orderOrStatus !== null ? orderOrStatus.status : orderOrStatus;
	const driverStatus = typeof orderOrStatus === 'object' && orderOrStatus !== null ? orderOrStatus.driverStatus : driverStatusArg;
	const normalized = String(status || '').toLowerCase();
	const normalizedDriverStatus = String(driverStatus || '').toLowerCase();
	if (['delivered', 'cancelled', 'canceled', 'refunded'].includes(normalized)) return true;
	return ['delivered', 'delivery_completed'].includes(normalizedDriverStatus);
}

// Customer: create order (uses provided items or cart)
router.post('/me', authenticate, requireRole(['customer']), async (req, res) => {
	try {
		const { items: bodyItems, shippingAddress, paymentMethod = 'cod', tax = 0, shippingCost = 0, couponCode, orderNote, addressLatitude, addressLongitude } = req.body || {};
		if (!shippingAddress) {
			return res.status(400).json({ success: false, message: 'shippingAddress is required' });
		}
		
		// Validate delivery area if settings are configured
		if (addressLatitude != null && addressLongitude != null) {
			try {
				const Settings = require('../models/Settings');
				const settings = await Settings.findOne().lean();
				if (settings?.deliveryArea?.latitude != null && settings?.deliveryArea?.longitude != null && settings?.deliveryArea?.radius != null) {
					const distance = calculateDistance(
						Number(addressLatitude),
						Number(addressLongitude),
						Number(settings.deliveryArea.latitude),
						Number(settings.deliveryArea.longitude)
					);
					if (distance > Number(settings.deliveryArea.radius)) {
						return res.status(400).json({ 
							success: false, 
							message: `Delivery is not available at this location. Your address is ${distance.toFixed(2)} km away from our delivery area (maximum ${settings.deliveryArea.radius} km).` 
						});
					}
				}
			} catch (err) {
				console.error('Error validating delivery area:', err);
				// Don't block order if validation fails, but log error
			}
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
                adminUnitPrice: (ci.variantInfo?.price != null ? ci.variantInfo.price : (ci.product?.regularPrice ?? 0)),
                adminUnitSpecialPrice: (ci.variantInfo?.specialPrice != null ? ci.variantInfo.specialPrice : (ci.product?.specialPrice ?? null)),
                vendorUnitPrice: (ci.variantInfo?.vendorPrice != null ? ci.variantInfo.vendorPrice : (ci.product?.vendorRegularPrice ?? null)),
                quantity: ci.quantity,
                image: (ci.variantInfo?.images && ci.variantInfo.images[0]) || (Array.isArray(ci.images) && ci.images[0]) || null,
                selectedAttributes: ci.selectedAttributes || {},
            }));
		} else {
			// Enrich client-provided items with unit prices derived from product/variant
			try {
				const ids = items.map(i => i.product).filter(Boolean);
                const prods = await Product.find({ _id: { $in: ids } })
                    .select('_id name sku images regularPrice specialPrice vendorRegularPrice variants')
					.lean();
				const idToProduct = new Map(prods.map(p => [String(p._id), p]));
				items = items.map(i => {
					const p = idToProduct.get(String(i.product));
					if (!p) return i;
					const sel = i.selectedAttributes || {};
					let matchedVariant = null;
					try {
						if (sel && Object.keys(sel).length > 0 && Array.isArray(p.variants)) {
							matchedVariant = p.variants.find(v => {
								let vAttrs = {};
								try {
									if (v.attributes && typeof v.attributes.toJSON === 'function') vAttrs = v.attributes.toJSON();
									else if (v.attributes && typeof v.attributes.get === 'function') {
										try { vAttrs = Object.fromEntries(v.attributes); } catch (_) { vAttrs = {}; }
									}
									else vAttrs = v.attributes || {};
								} catch (_) { vAttrs = v.attributes || {}; }
								return Object.keys(sel).every(k => String(vAttrs[k]) === String(sel[k]));
							});
						}
					} catch (_) {}
					// Fallback: if variant not matched by attributes, try by SKU provided in request
					if (!matchedVariant) {
						const reqSku = String(i.sku || '').trim();
						if (reqSku && Array.isArray(p.variants)) {
							const target = reqSku.toLowerCase();
							matchedVariant = p.variants.find(v => String(v.sku || '').trim().toLowerCase() === target);
						}
					}
					const adminUnitPrice = (matchedVariant && matchedVariant.price != null) ? matchedVariant.price : (p.regularPrice ?? 0);
					const adminUnitSpecialPrice = (matchedVariant && matchedVariant.specialPrice != null) ? matchedVariant.specialPrice : (p.specialPrice ?? null);
                    const vendorUnitPrice = (matchedVariant && matchedVariant.vendorPrice != null) ? matchedVariant.vendorPrice : (p.vendorRegularPrice ?? null);
					const sku = i.sku || (matchedVariant?.sku ?? p.sku ?? '');
					const image = i.image || (Array.isArray(matchedVariant?.images) && matchedVariant.images[0]) || (Array.isArray(p.images) && p.images[0]) || null;
					const name = i.name || p.name || 'Product';
					return {
						...i,
						name,
						sku,
						image,
						// Ensure effective customer price uses admin prices at order time
						price: (adminUnitSpecialPrice != null ? adminUnitSpecialPrice : adminUnitPrice),
						adminUnitPrice,
						adminUnitSpecialPrice,
						vendorUnitPrice,
					};
				});
			} catch (_) {}
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

		// Debug: Log coordinates before saving
		console.log('🔍 Creating order with coordinates:');
		console.log('   Order Number:', orderNumber);
		console.log('   addressLatitude:', addressLatitude, 'Type:', typeof addressLatitude);
		console.log('   addressLongitude:', addressLongitude, 'Type:', typeof addressLongitude);
		console.log('   deliveryLatitude (to save):', addressLatitude != null ? Number(addressLatitude) : null);
		console.log('   deliveryLongitude (to save):', addressLongitude != null ? Number(addressLongitude) : null);

		const order = await Order.create({
			user: req.user.id,
			orderNumber,
			status: 'confirmed',
			items,
			shippingAddress,
			deliveryLatitude: addressLatitude != null ? Number(addressLatitude) : null,
			deliveryLongitude: addressLongitude != null ? Number(addressLongitude) : null,
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

		// Debug: Verify saved coordinates
		console.log('✅ Order created. Saved coordinates:');
		console.log('   deliveryLatitude:', order.deliveryLatitude);
		console.log('   deliveryLongitude:', order.deliveryLongitude);
		
		// Reduce stock for order items
		await reduceStockForOrderItems(items);
		
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
		
		// Populate product details for items
		try {
			const productIds = Array.from(new Set((order.items || []).map(it => String(it.product)).filter(Boolean)));
			if (productIds.length > 0) {
				const products = await Product.find({ _id: { $in: productIds } })
					.select('name description shortDescription brand category images')
					.populate('brand', 'name')
					.populate('category', 'name')
					.lean();
				const productMap = new Map(products.map(p => [String(p._id), p]));
				for (const item of (order.items || [])) {
					const productId = String(item.product);
					const product = productMap.get(productId);
					if (product) {
						item.productDetails = {
							name: product.name,
							description: product.description,
							shortDescription: product.shortDescription,
							brand: product.brand,
							category: product.category,
							images: product.images
						};
					}
				}
			}
		} catch (_) {}
		
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

// Customer: cancel order
router.post('/me/:id/cancel', authenticate, requireRole(['customer']), async (req, res) => {
	try {
		const { cancellationReason } = req.body || {};
		if (!cancellationReason || !cancellationReason.trim()) {
			return res.status(400).json({ success: false, message: 'cancellationReason is required' });
		}
		const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
		if (!order) {
			return res.status(404).json({ success: false, message: 'Order not found' });
		}
		// Only allow cancellation if order is not already cancelled, delivered, or shipped
		if (order.status === 'cancelled' || order.status === 'refunded') {
			return res.status(400).json({ success: false, message: 'Order is already cancelled' });
		}
		if (order.status === 'delivered') {
			return res.status(400).json({ success: false, message: 'Cannot cancel delivered order' });
		}
		if (order.status === 'shipped') {
			return res.status(400).json({ success: false, message: 'Cannot cancel shipped order. Please contact support.' });
		}
		const previousStatus = order.status;
		order.status = 'cancelled';
		order.cancellationReason = String(cancellationReason).trim();
		order.statusHistory.push({ status: 'cancelled', updatedBy: req.user?.name || 'customer' });
		await order.save();
		
		// Restore stock
		await restoreStockForOrderItems(order.items || []);
		
		res.json({ success: true, message: 'Order cancelled successfully', data: order });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to cancel order' });
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
			Order.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email phone').populate('driver', 'name email phone').lean(),
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

// Admin: download invoice PDF
router.get('/:id/invoice.pdf', authenticate, requireAdmin, async (req, res) => {
	try {
		const o = await Order.findById(req.params.id).populate('user', 'name email phone').lean();
		if (!o) {
			res.status(404);
			throw new Error('Order not found');
		}

		// Load currency settings
		let currencySymbol = '₹';
		let currencyCode = 'INR';
		let decimalPlaces = 2;
		try {
			const s = await Settings.findOne().lean();
			if (s && s.localization) {
				if (s.localization.currency) currencyCode = s.localization.currency;
				if (s.localization.currencySymbol) currencySymbol = s.localization.currencySymbol;
				if (typeof s.localization.decimalPlaces === 'number') decimalPlaces = s.localization.decimalPlaces;
			}
		} catch (_) {}
		// Built-in PDF fonts do not support some Unicode symbols (e.g., ₹). Fallback to currency code if non-ASCII.
		const currencyLabel = (/^[\x20-\x7E]+$/.test(String(currencySymbol || '')) && String(currencySymbol).trim() !== '')
			? String(currencySymbol)
			: `${String(currencyCode || 'INR')} `;

		// Set headers for file download
		const filename = `invoice-${o.orderNumber || o._id}.pdf`;
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

		// Build PDF
		const doc = new PDFDocument({ size: 'A4', margin: 36 });
		doc.pipe(res);

		// Header
		doc.fontSize(20).text('INVOICE', { align: 'right' });
		doc.moveDown(0.5);
		doc.fontSize(10).text(`Invoice #: INV-${o.orderNumber || o._id}` , { align: 'right' });
		doc.text(`Date: ${new Date(o.createdAt).toLocaleDateString()}`, { align: 'right' });
		doc.moveDown(1);

		// Bill To
		doc.fontSize(12).text('Bill To:', { underline: true });
		const customerName = (o.user && o.user.name) || 'Customer';
		const customerEmail = (o.user && o.user.email) || (o.customerEmail || '');
		const customerPhone = o.customerPhone || (o.user && o.user.phone) || '';
		const cleanAddress = (() => {
			try {
				const parts = String(o.shippingAddress || '').split(',').map(s => s.trim()).filter(Boolean);
				return parts.join(', ');
			} catch (_) { return String(o.shippingAddress || ''); }
		})();
		doc.fontSize(10).text(customerName);
		if (customerEmail) doc.text(customerEmail);
		if (customerPhone) doc.text(customerPhone);
		if (cleanAddress) doc.text(cleanAddress);
		doc.moveDown(1);

		// Items table header
		doc.fontSize(12).text('Items', { underline: true });
		doc.moveDown(0.5);
		const startX = doc.x;
		const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		const colWidths = [tableWidth * 0.50, tableWidth * 0.15, tableWidth * 0.15, tableWidth * 0.20];
		const drawRow = (name, qty, price, total, bold = false) => {
			if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
			doc.text(name, startX, doc.y, { width: colWidths[0] });
			doc.text(String(qty), startX + colWidths[0], doc.y, { width: colWidths[1], align: 'right' });
			doc.text(`${currencyLabel}${Number(price).toFixed(decimalPlaces)}`, startX + colWidths[0] + colWidths[1], doc.y, { width: colWidths[2], align: 'right' });
			doc.text(`${currencyLabel}${Number(total).toFixed(decimalPlaces)}`, startX + colWidths[0] + colWidths[1] + colWidths[2], doc.y, { width: colWidths[3], align: 'right' });
			doc.moveDown(0.3);
		};

		doc.font('Helvetica-Bold');
		drawRow('Item', 'Qty', 'Price', 'Total', true);
		doc.moveDown(0.2);
		doc.font('Helvetica');

		(o.items || []).forEach(it => {
			const lineTotal = Number(it.price || 0) * Number(it.quantity || 0);
			drawRow(it.name || 'Item', it.quantity || 0, (it.price || 0), lineTotal);
		});

		doc.moveDown(0.8);
		// Summary
		const subtotal = Number(o.subtotal || (o.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0));
		const taxPercent = Number(o.tax || 0);
		const taxAmount = (subtotal * taxPercent) / 100;
		const shipping = Number(o.shippingCost || 0);
		const discount = Number(o.discountAmount || 0);
		const total = Math.max(0, subtotal + taxAmount + shipping - discount);

		const rightX = startX + colWidths[0] + colWidths[1] + colWidths[2];
		const labelWidth = colWidths[0] + colWidths[1] + colWidths[2];

		const summaryRow = (label, value, bold = false) => {
			if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
			doc.text(label, startX + colWidths[0] + colWidths[1], doc.y, { width: colWidths[2], align: 'right' });
			doc.text(value, rightX, doc.y, { width: colWidths[3], align: 'right' });
			doc.moveDown(0.2);
		};

		summaryRow('Subtotal:', `${currencyLabel}${subtotal.toFixed(decimalPlaces)}`);
		summaryRow(`Tax (${taxPercent}%):`, `${currencyLabel}${taxAmount.toFixed(decimalPlaces)}`);
		summaryRow('Shipping:', `${currencyLabel}${shipping.toFixed(decimalPlaces)}`);
		if (discount > 0) summaryRow('Discount:', `- ${currencyLabel}${discount.toFixed(decimalPlaces)}`);
		summaryRow('Total:', `${currencyLabel}${total.toFixed(decimalPlaces)}`, true);

		if (o.orderNote) {
			doc.moveDown(1);
			doc.font('Helvetica-Bold').text('Order Note:');
			doc.font('Helvetica').text(String(o.orderNote), { width: tableWidth });
		}

		doc.end();
	} catch (err) {
		console.error('Invoice PDF error:', err);
		if (!res.headersSent) {
			res.status(500);
			res.end();
		}
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
		const { status, cancellationReason } = req.body || {};
		const driverStatuses = ['pickup_completed', 'on_the_way', 'delivered'];
		if (!status) return res.status(400).json({ success: false, message: 'status is required' });
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		
		const previousStatus = order.status;
		const isCancelling = (status === 'cancelled' || status === 'refunded') && previousStatus !== 'cancelled' && previousStatus !== 'refunded';
		const isRestoring = (previousStatus === 'cancelled' || previousStatus === 'refunded') && status !== 'cancelled' && status !== 'refunded';
		const isDriverStatusUpdate = driverStatuses.includes(status);

		if (isDriverStatusUpdate) {
			order.driverStatus = status;
			order.driverStatusHistory = Array.isArray(order.driverStatusHistory) ? order.driverStatusHistory : [];
			order.driverStatusHistory.push({ status, updatedBy: req.user?.name || 'admin' });
			order.statusHistory.push({ status: `driver:${status}`, updatedBy: req.user?.name || 'admin' });
			if (status === 'delivered') {
				order.status = 'delivered';
				order.statusHistory.push({ status: 'delivered', updatedBy: req.user?.name || 'admin' });
			}
		} else {
			order.status = status;
			if (status === 'delivered' && order.driver) {
				order.driverStatus = 'delivered';
				order.driverStatusHistory = Array.isArray(order.driverStatusHistory) ? order.driverStatusHistory : [];
				order.driverStatusHistory.push({ status: 'delivered', updatedBy: req.user?.name || 'admin' });
				order.statusHistory.push({ status: 'driver:delivered', updatedBy: req.user?.name || 'admin' });
			}
			if (isCancelling && cancellationReason) {
				order.cancellationReason = String(cancellationReason).trim();
			}
			order.statusHistory.push({ status, updatedBy: req.user?.name || 'admin' });
		}
		await order.save();
		
		// Restore stock if order is being cancelled
		if (isCancelling) {
			await restoreStockForOrderItems(order.items || []);
		}
		// Reduce stock if order is being restored from cancelled status
		if (isRestoring && (status === 'confirmed' || status === 'processing')) {
			await reduceStockForOrderItems(order.items || []);
		}
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
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		
		// Restore stock if order was not already cancelled/refunded
		if (order.status !== 'cancelled' && order.status !== 'refunded') {
			await restoreStockForOrderItems(order.items || []);
		}
		
		await Order.findByIdAndDelete(req.params.id);
		res.json({ success: true, message: 'Order deleted' });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to delete order' });
	}
});

router.patch('/:id/driver-commission', authenticate, requireAdmin, async (req, res) => {
	try {
		const { driverCommission } = req.body || {};
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		if (String(order.status || '').toLowerCase() !== 'delivered') {
			return res.status(400).json({ success: false, message: 'Driver commission can only be set for delivered orders' });
		}
		const amount = Number(driverCommission);
		if (!Number.isFinite(amount) || amount < 0) {
			return res.status(400).json({ success: false, message: 'driverCommission must be a non-negative number' });
		}
		order.driverCommission = amount;
		order.statusHistory.push({ status: `driver:commission:${amount}`, updatedBy: req.user?.name || 'admin' });
		await order.save();
		const populatedOrder = await Order.findById(order._id)
			.populate('user', 'name email phone')
			.populate('driver', 'name email phone')
			.lean();
		res.json({ success: true, data: populatedOrder });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to update driver commission' });
	}
});

module.exports = router;

// Admin: assign driver to order
router.post('/:id/assign-driver', authenticate, requireAdmin, async (req, res) => {
    try {
        const { driverId, driverEmail } = req.body || {};
        let driver = null;
        if (driverId) {
            driver = await Driver.findById(driverId).lean();
        } else if (driverEmail) {
            driver = await Driver.findOne({ email: String(driverEmail).trim().toLowerCase() }).lean();
        }
        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (isTerminalOrderStatus(order)) {
            return res.status(409).json({ success: false, message: 'Delivered, cancelled, or refunded orders cannot be assigned or reassigned' });
        }
        const busyOrder = await Order.findOne(buildActiveDriverOrderQuery(driver._id, order._id))
            .select('orderNumber')
            .lean();
        if (busyOrder) {
            return res.status(409).json({
                success: false,
                message: `Driver is busy with order ${busyOrder.orderNumber || busyOrder._id}`,
            });
        }
        order.driver = driver._id;
        order.driverStatus = 'assigned';
        order.driverStatusHistory = Array.isArray(order.driverStatusHistory) ? order.driverStatusHistory : [];
        order.driverStatusHistory.push({ status: 'assigned', updatedBy: req.user?.email || 'admin' });
        order.statusHistory.push({ status: 'driver:assigned', updatedBy: req.user?.email || 'admin' });
        await order.save();
        const populatedOrder = await Order.findById(order._id)
            .populate('user', 'name email phone')
            .populate('driver', 'name email phone')
            .lean();
        res.json({ success: true, data: populatedOrder });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to assign driver' });
    }
});

router.delete('/:id/assign-driver', authenticate, requireAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (isTerminalOrderStatus(order)) {
            return res.status(409).json({ success: false, message: 'Delivered, cancelled, or refunded orders cannot be assigned or changed' });
        }
        order.driver = undefined;
        order.driverStatus = undefined;
        order.driverStatusHistory = Array.isArray(order.driverStatusHistory) ? order.driverStatusHistory : [];
        order.driverStatusHistory.push({ status: 'unassigned', updatedBy: req.user?.email || 'admin' });
        order.statusHistory.push({ status: 'driver:unassigned', updatedBy: req.user?.email || 'admin' });
        await order.save();
        const populatedOrder = await Order.findById(order._id)
            .populate('user', 'name email phone')
            .populate('driver', 'name email phone')
            .lean();
        res.json({ success: true, data: populatedOrder });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to remove driver' });
    }
});

// Driver: list my assigned orders
router.get('/driver', authenticate, requireRole(['driver']), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const p = Math.max(parseInt(page, 10) || 1, 1);
        const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const query = { driver: req.user.driverId || req.user.id };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).populate('user', 'name email phone').lean(),
            Order.countDocuments(query)
        ]);
        res.json({ success: true, data: orders, meta: { total, page: p, limit: l } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to list driver orders' });
    }
});

// Driver: update driver delivery status
router.patch('/driver/:id/status', authenticate, requireRole(['driver']), async (req, res) => {
    try {
        const { status } = req.body || {};
        const allowed = ['pickup_completed','on_the_way','delivered'];
        if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (isTerminalOrderStatus(order)) {
            return res.status(409).json({ success: false, message: 'This order is already closed' });
        }
        if (String(order.driver || '') !== String(req.user.driverId || req.user.id)) {
            return res.status(403).json({ success: false, message: 'Not your order' });
        }
        order.driverStatus = status;
        order.driverStatusHistory = Array.isArray(order.driverStatusHistory) ? order.driverStatusHistory : [];
        order.driverStatusHistory.push({ status, updatedBy: req.user?.email || 'driver' });
        order.statusHistory.push({ status: `driver:${status}`, updatedBy: req.user?.email || 'driver' });
        if (status === 'delivered') {
            order.status = 'delivered';
            order.statusHistory.push({ status: 'delivered', updatedBy: req.user?.email || 'driver' });
        }
        await order.save();
        res.json({ success: true, data: order });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
});

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
        const primaryVendorId = vendorIds[0];
        const previousVendorStatus = order.vendorStatuses?.get ? order.vendorStatuses.get(String(primaryVendorId)) : (order.vendorStatuses?.[String(primaryVendorId)] || order.status);
        const isVendorCancelling = (status === 'cancelled' || status === 'refunded') && previousVendorStatus !== 'cancelled' && previousVendorStatus !== 'refunded';
        const isVendorRestoring = (previousVendorStatus === 'cancelled' || previousVendorStatus === 'refunded') && status !== 'cancelled' && status !== 'refunded';
        
        order.statusHistory.push({ status: `vendor:${status}`, updatedBy: req.user?.email || 'vendor' });
        // Record vendor-specific status
        try {
            order.vendorStatuses = order.vendorStatuses || new Map();
            order.vendorStatuses.set(String(primaryVendorId), status);
            order.vendorStatusHistory = Array.isArray(order.vendorStatusHistory) ? order.vendorStatusHistory : [];
            order.vendorStatusHistory.push({ vendor: primaryVendorId, status, updatedBy: req.user?.email || 'vendor' });
        } catch (_) {}
        await order.save();
        
        // Restore stock for vendor's items if vendor is cancelling
        if (isVendorCancelling) {
            await restoreStockForOrderItems(vendorItems);
        }
        // Reduce stock if vendor is restoring from cancelled status
        if (isVendorRestoring && (status === 'confirmed' || status === 'processing')) {
            await reduceStockForOrderItems(vendorItems);
        }

        // Build vendor-scoped response payload
        const itemsScoped = (order.items || []).filter(it => String(it.vendor) === String(primaryVendorId));

        // Resolve vendor unit prices for each item (by SKU first, then attributes),
        // and attach vendorDisplayUnitPrice and vendorLineTotal for consistent UI display
        let idToProduct = new Map();
        try {
            const productIds = Array.from(new Set(itemsScoped.map(it => String(it.product)).filter(Boolean)));
            if (productIds.length) {
                const prods = await Product.find({ _id: { $in: productIds } })
                    .select('_id vendor vendorRegularPrice variants')
                    .lean();
                idToProduct = new Map(prods.map(p => [String(p._id), p]));
            }
        } catch (_) {}

        const resolveVendorUnit = (it) => {
            try {
                const p = idToProduct.get(String(it.product));
                if (!p) return { unit: (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : null };
                const sku = String(it.sku || '').trim().toLowerCase();
                let v = null;
                if (sku && Array.isArray(p.variants)) {
                    v = p.variants.find(vn => String(vn.sku || '').trim().toLowerCase() === sku);
                }
                if (!v && Array.isArray(p.variants)) {
                    let sel = it.selectedAttributes || {};
                    try {
                        if (sel && typeof sel.toJSON === 'function') sel = sel.toJSON();
                        else if (sel && typeof sel.get === 'function') { try { sel = Object.fromEntries(sel); } catch (_) { sel = {}; } }
                    } catch (_) {}
                    if (sel && Object.keys(sel).length > 0) {
                        v = p.variants.find(vn => {
                            let vAttrs = vn.attributes || {};
                            try {
                                if (vAttrs && typeof vAttrs.toJSON === 'function') vAttrs = vAttrs.toJSON();
                                else if (vAttrs && typeof vAttrs.get === 'function') { try { vAttrs = Object.fromEntries(vAttrs); } catch (_) { vAttrs = {}; } }
                            } catch (_) {}
                            return Object.keys(sel).every(k => String(vAttrs[k]) === String(sel[k]));
                        });
                    }
                }
                if (v) {
                    return {
                        unit: (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : ((v.vendorPrice != null) ? Number(v.vendorPrice) : null),
                    };
                }
                return {
                    unit: (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : ((p.vendorRegularPrice != null) ? Number(p.vendorRegularPrice) : null),
                };
            } catch (_) {}
            return { unit: (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : null };
        };

        const itemsScopedWithDisplay = itemsScoped.map(it => {
            const { unit } = resolveVendorUnit(it);
            const display = (unit != null ? unit : Number(it.price || 0));
            const quantity = Number(it.quantity || 0);
            return {
                ...it.toObject ? it.toObject() : it,
                vendorUnitPrice: unit,
                vendorDisplayUnitPrice: display,
                vendorLineTotal: display * quantity,
            };
        });

        const vendorSubtotal = itemsScopedWithDisplay.reduce((s, it) => s + (Number(it.vendorDisplayUnitPrice || 0) * Number(it.quantity || 0)), 0);
        const orderSubtotal = Number(order.subtotal || 0);
        const taxPercent = Number(order.tax || 0);
        const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
        const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
        const vendorTaxShare = orderTaxAmount * share;
        const vendorShippingShare = Number(order.shippingCost || 0) * share;
        const vendorDiscountShare = Number(order.discountAmount || 0) * share;
        const vendorTotalShare = vendorSubtotal + vendorTaxShare + vendorShippingShare - vendorDiscountShare;
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
            items: itemsScopedWithDisplay,
            vendorSubtotal,
            vendorTaxShare,
            vendorShippingShare,
            vendorTotalShare,
            vendorDiscountShare,
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

        // Prefetch products referenced across these orders for accurate vendor unit resolution by SKU
        const allProductIds = Array.from(new Set(orders.flatMap(o => (o.items || []).map(it => String(it.product)).filter(Boolean))));
        let idToProduct = new Map();
        try {
            const prods = await Product.find({ _id: { $in: allProductIds } })
                .select('_id vendor vendorRegularPrice variants')
                .lean();
            idToProduct = new Map(prods.map(p => [String(p._id), p]));
        } catch (_) {}
        const resolveVendorUnit = (it) => {
            try {
                const p = idToProduct.get(String(it.product));
                if (!p) return { unit: (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : null };
                const sku = String(it.sku || '').trim().toLowerCase();
                let v = null;
                if (sku && Array.isArray(p.variants)) {
                    v = p.variants.find(vn => String(vn.sku || '').trim().toLowerCase() === sku);
                }
                // If no match by SKU, try matching by selectedAttributes
                if (!v && Array.isArray(p.variants)) {
                    let sel = it.selectedAttributes || {};
                    try {
                        if (sel && typeof sel.toJSON === 'function') sel = sel.toJSON();
                        else if (sel && typeof sel.get === 'function') { try { sel = Object.fromEntries(sel); } catch (_) { sel = {}; } }
                    } catch (_) {}
                    if (sel && Object.keys(sel).length > 0) {
                        v = p.variants.find(vn => {
                            let vAttrs = vn.attributes || {};
                            try {
                                if (vAttrs && typeof vAttrs.toJSON === 'function') vAttrs = vAttrs.toJSON();
                                else if (vAttrs && typeof vAttrs.get === 'function') { try { vAttrs = Object.fromEntries(vAttrs); } catch (_) { vAttrs = {}; } }
                            } catch (_) {}
                            return Object.keys(sel).every(k => String(vAttrs[k]) === String(sel[k]));
                        });
                    }
                }
                if (v) {
                    return {
                        unit: (v.vendorPrice != null) ? Number(v.vendorPrice) : null,
                    };
                }
                return {
                    unit: (p.vendorRegularPrice != null) ? Number(p.vendorRegularPrice) : null,
                };
            } catch (_) {}
            return { unit: null };
        };

        // For each order, filter items to only this vendor set and compute vendor totals
        const mapped = orders.map(o => {
            const vendorItems = (o.items || []).filter(it => vendorIds.includes(String(it.vendor)));
            const vendorItemsWithDisplay = vendorItems.map(it => {
                const explicitRegular = (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : null;
                const { unit } = resolveVendorUnit(it);
                const finalRegular = (explicitRegular != null) ? explicitRegular : (unit != null ? unit : null);
                const display = (finalRegular != null ? finalRegular : Number(it.price || 0));
                const quantity = Number(it.quantity || 0);
                return { ...it, vendorUnitPrice: finalRegular, vendorDisplayUnitPrice: display, vendorLineTotal: display * quantity };
            });
            const vendorSubtotal = vendorItemsWithDisplay.reduce((s, it) => s + (Number(it.vendorDisplayUnitPrice || 0) * Number(it.quantity || 0)), 0);
            const vendorCommissionBase = vendorItems.reduce((s, it) => s + Number(it.commissionAmount || 0), 0);
            const vendorCommission = vendorCommissionBase + vendorTaxShare + vendorShippingShare;
            const vendorNet = vendorSubtotal - vendorCommission;
            const orderSubtotal = Number(o.subtotal || 0);
            const taxPercent = Number(o.tax || 0);
            const orderTaxAmount = (orderSubtotal * taxPercent) / 100;
            const share = orderSubtotal > 0 ? (vendorSubtotal / orderSubtotal) : 0;
            const vendorTaxShare = orderTaxAmount * share;
            const vendorShippingShare = Number(o.shippingCost || 0) * share;
            const orderDiscountAmount = Number(o.discountAmount || 0);
            const vendorDiscountShare = orderDiscountAmount * share;
            const vendorTotalShare = vendorSubtotal + vendorTaxShare + vendorShippingShare - vendorDiscountShare;
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
            items: vendorItemsWithDisplay,
                vendorItemCount: vendorItems.length,
                vendorSubtotal,
                vendorCommission,
                vendorNet,
                vendorTaxShare,
                vendorShippingShare,
                vendorTotalShare,
                vendorDiscountShare,
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

        // Resolve vendor unit price from product/variant by SKU or attributes if missing
        try {
            const productIds = Array.from(new Set(vendorItems.map(it => String(it.product)).filter(Boolean)));
            const prods = await Product.find({ _id: { $in: productIds } }).select('_id vendor vendorRegularPrice variants').lean();
            const idToProduct = new Map(prods.map(p => [String(p._id), p]));
            for (const it of vendorItems) {
                const p = idToProduct.get(String(it.product));
                if (!p) continue;
                const sku = String(it.sku || '').trim().toLowerCase();
                let v = null;
                if (sku && Array.isArray(p.variants)) v = p.variants.find(vn => String(vn.sku || '').trim().toLowerCase() === sku);
                if (!v && Array.isArray(p.variants)) {
                    let sel = it.selectedAttributes || {};
                    try {
                        if (sel && typeof sel.toJSON === 'function') sel = sel.toJSON();
                        else if (sel && typeof sel.get === 'function') { try { sel = Object.fromEntries(sel); } catch (_) { sel = {}; } }
                    } catch (_) {}
                    if (sel && Object.keys(sel).length > 0) {
                        v = p.variants.find(vn => {
                            let vAttrs = vn.attributes || {};
                            try {
                                if (vAttrs && typeof vAttrs.toJSON === 'function') vAttrs = vAttrs.toJSON();
                                else if (vAttrs && typeof vAttrs.get === 'function') { try { vAttrs = Object.fromEntries(vAttrs); } catch (_) { vAttrs = {}; } }
                            } catch (_) {}
                            return Object.keys(sel).every(k => String(vAttrs[k]) === String(sel[k]));
                        });
                    }
                }
                if (v) {
                    if (it.vendorUnitPrice == null && v.vendorPrice != null) it.vendorUnitPrice = Number(v.vendorPrice);
                } else {
                    if (it.vendorUnitPrice == null && p.vendorRegularPrice != null) it.vendorUnitPrice = Number(p.vendorRegularPrice);
                }
            }
        } catch (_) {}

        // Attach vendorDisplayUnitPrice and vendorLineTotal for consistent UI display
        const vendorItemsWithDisplay = vendorItems.map(it => {
            const explicitRegular = (it.vendorUnitPrice != null) ? Number(it.vendorUnitPrice) : null;
            let unit = explicitRegular;
            if (unit == null) {
                try {
                    const p = idToProduct.get(String(it.product));
                    if (p) {
                        const sku = String(it.sku || '').trim().toLowerCase();
                        let v = null;
                        if (sku && Array.isArray(p.variants)) v = p.variants.find(vn => String(vn.sku || '').trim().toLowerCase() === sku);
                        if (!v && Array.isArray(p.variants)) {
                            let sel = it.selectedAttributes || {};
                            try {
                                if (sel && typeof sel.toJSON === 'function') sel = sel.toJSON();
                                else if (sel && typeof sel.get === 'function') { try { sel = Object.fromEntries(sel); } catch (_) { sel = {}; } }
                            } catch (_) {}
                            if (sel && Object.keys(sel).length > 0) {
                                v = p.variants.find(vn => {
                                    let vAttrs = vn.attributes || {};
                                    try {
                                        if (vAttrs && typeof vAttrs.toJSON === 'function') vAttrs = vAttrs.toJSON();
                                        else if (vAttrs && typeof vAttrs.get === 'function') { try { vAttrs = Object.fromEntries(vAttrs); } catch (_) { vAttrs = {}; } }
                                    } catch (_) {}
                                    return Object.keys(sel).every(k => String(vAttrs[k]) === String(sel[k]));
                                });
                            }
                        }
                        if (unit == null) unit = (v && v.vendorPrice != null) ? Number(v.vendorPrice) : ((p.vendorRegularPrice != null) ? Number(p.vendorRegularPrice) : null);
                    }
                } catch (_) {}
            }
            const display = (unit != null ? unit : Number(it.price || 0));
            const quantity = Number(it.quantity || 0);
            return {
                ...it,
                vendorUnitPrice: unit,
                vendorDisplayUnitPrice: display,
                vendorLineTotal: display * quantity,
            };
        });
        const vendorSubtotal = vendorItemsWithDisplay.reduce((s, it) => s + (Number(it.vendorDisplayUnitPrice || 0) * Number(it.quantity || 0)), 0);
        const vendorCommissionBase = vendorItems.reduce((s, it) => s + Number(it.commissionAmount || 0), 0);
        const vendorCommission = vendorCommissionBase + vendorTaxShare + vendorShippingShare;
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
            items: vendorItemsWithDisplay,
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
