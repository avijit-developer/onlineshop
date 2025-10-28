const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
	try {
		const [orders, totalCustomers, totalVendors, lowStockProducts, pendingVendors, pendingProducts] = await Promise.all([
			Order.find({}).populate('user', 'name email phone').lean(),
			User.countDocuments({ passwordHash: { $exists: true, $ne: null } }),
			Vendor.countDocuments({}),
			Product.countDocuments({ stock: { $lte: 5 } }),
			Vendor.countDocuments({ status: 'pending' }),
			Product.countDocuments({ status: 'pending' }),
		]);
		// Restrict key metrics and charts to delivered orders only
		const deliveredOrders = orders.filter(o => String(o.status || '').toLowerCase() === 'delivered');
		const totalOrders = deliveredOrders.length;
		const totalSales = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
		const recentOrders = orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
		// Simple top products by quantity
		const productSales = new Map();
		for (const o of orders) {
			for (const it of o.items || []) {
				const key = String(it.product);
				productSales.set(key, (productSales.get(key) || 0) + (it.quantity || 0));
			}
		}
		const topProductIds = Array.from(productSales.entries()).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id]) => id);
		const topProducts = await Product.find({ _id: { $in: topProductIds } }).lean();
		// Build sales series: daily (Mon..Sun), last 7 weeks, last 7 months
		const daily = Array(7).fill(0); // 0=Mon .. 6=Sun
		const weekly = Array(7).fill(0); // oldest..latest
		const monthly = Array(7).fill(0); // oldest..latest
		const now = new Date();
		const msPerDay = 24 * 60 * 60 * 1000;
		for (const o of deliveredOrders) {
			const dt = o.createdAt ? new Date(o.createdAt) : null;
			if (!dt || isNaN(dt.getTime())) continue;
			const amount = Number(o.total || 0);
			// Daily: bucket by day-of-week (Mon..Sun)
			const dow = dt.getDay(); // 0..6, 0=Sun
			const monIdx = (dow + 6) % 7; // convert to 0=Mon .. 6=Sun
			daily[monIdx] += amount;
			// Weekly: bucket by weeks ago (0..6), render oldest..latest
			const diffDays = Math.floor((now - dt) / msPerDay);
			if (diffDays >= 0) {
				const weeksAgo = Math.min(6, Math.max(0, Math.floor(diffDays / 7)));
				weekly[6 - weeksAgo] += amount;
			}
			// Monthly: bucket by month difference (0..6), render oldest..latest
			const monthDiff = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth());
			if (monthDiff >= 0) {
				const clamped = Math.min(6, Math.max(0, monthDiff));
				monthly[6 - clamped] += amount;
			}
		}
		res.json({ success: true, data: {
			stats: { totalSales, totalOrders, totalVendors, totalCustomers, pendingApprovals: pendingVendors, pendingProductApprovals: pendingProducts, lowStockProducts },
			recentOrders,
			topProducts: topProducts.map(p => ({ id: p._id, name: p.name, images: p.images, stock: p.stock, specialPrice: p.specialPrice })),
				salesData: { daily, weekly, monthly }
		}});
	} catch (err) {
		console.error('Dashboard error', err);
		res.status(500).json({ success: false, message: 'Failed to load dashboard' });
	}
});

module.exports = router;