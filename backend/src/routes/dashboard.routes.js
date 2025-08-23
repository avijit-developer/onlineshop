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
			Order.find({}).lean(),
			User.countDocuments({ passwordHash: { $exists: true, $ne: null } }),
			Vendor.countDocuments({}),
			Product.countDocuments({ stock: { $lte: 5 } }),
			Vendor.countDocuments({ status: 'pending' }),
			Product.countDocuments({ status: 'pending' }),
		]);
		const totalOrders = orders.length;
		const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
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
		// Build simple sales series (last 7 days)
		const seriesDaily = Array(7).fill(0);
		orders.forEach(o => {
			const daysAgo = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / (1000*60*60*24));
			if (daysAgo >= 0 && daysAgo < 7) {
				seriesDaily[6 - daysAgo] += (o.total || 0);
			}
		});
		res.json({ success: true, data: {
			stats: { totalSales, totalOrders, totalVendors, totalCustomers, pendingApprovals: (pendingVendors + pendingProducts), lowStockProducts },
			recentOrders,
			topProducts: topProducts.map(p => ({ id: p._id, name: p.name, images: p.images, stock: p.stock, specialPrice: p.specialPrice })),
			salesData: { daily: seriesDaily, weekly: seriesDaily, monthly: seriesDaily }
		}});
	} catch (err) {
		console.error('Dashboard error', err);
		res.status(500).json({ success: false, message: 'Failed to load dashboard' });
	}
});

module.exports = router;