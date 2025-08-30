const express = require('express');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { authenticate, requireRole, requireAdmin, requireAnyPermission } = require('../middleware/auth');

const router = express.Router();

// Admin/Vendor: list reviews with filters
router.get('/', authenticate, requireRole(['admin','vendor']), async (req, res) => {
  try {
    const { status = 'all', rating = 'all', q = '', page = 1, limit = 10 } = req.query;
    const filters = {};
    if (status !== 'all') filters.status = status;
    if (rating !== 'all') filters.rating = Number(rating);
    if (q) {
      filters.$or = [
        { title: { $regex: q, $options: 'i' } },
        { comment: { $regex: q, $options: 'i' } }
      ];
    }
    // Vendor users only see reviews of their vendors' products
    if (req.user.role === 'vendor' && Array.isArray(req.user.vendors) && req.user.vendors.length > 0) {
      filters.vendor = { $in: req.user.vendors };
    }
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const [items, total] = await Promise.all([
      Review.find(filters)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate('product', 'name vendor')
        .populate('user', 'name email')
        .lean(),
      Review.countDocuments(filters)
    ]);

    res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load reviews' });
  }
});

// Admin/Vendor: update review status
router.patch('/:id/status', authenticate, requireRole(['admin','vendor']), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending','approved','rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    // If vendor, ensure ownership
    if (req.user.role === 'vendor' && Array.isArray(req.user.vendors) && req.user.vendors.length > 0) {
      if (!req.user.vendors.map(String).includes(String(review.vendor))) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }
    review.status = status;
    await review.save();
    res.json({ success: true, data: review });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to update status' });
  }
});

// Admin/Vendor: delete review
router.delete('/:id', authenticate, requireRole(['admin','vendor']), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (req.user.role === 'vendor' && Array.isArray(req.user.vendors) && req.user.vendors.length > 0) {
      if (!req.user.vendors.map(String).includes(String(review.vendor))) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }
    await Review.deleteOne({ _id: review._id });
    res.json({ success: true, message: 'Review deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to delete review' });
  }
});

// Public: get reviews for a product (approved only)
router.get('/product/:productId/public', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, rating } = req.query;
    const filters = { product: productId, status: 'approved' };
    if (rating) filters.rating = Number(rating);
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const [items, total] = await Promise.all([
      Review.find(filters).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l)
        .populate('user', 'name email')
        .lean(),
      Review.countDocuments(filters)
    ]);
    const mapped = items.map(r => ({
      id: r._id,
      reviewerName: r.user?.name || r.user?.email || 'Customer',
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      createdAt: r.createdAt,
      images: r.images || []
    }));
    res.json({ success: true, data: mapped, meta: { total, page: p, limit: l } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to load product reviews' });
  }
});

module.exports = router;

