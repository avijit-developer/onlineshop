const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const Vendor = require('../models/Vendor');
const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /vendors?status=&q=&page=&limit=
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { status = 'all', q = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  if (status !== 'all') filters.status = status;
  if (q) {
    filters.$or = [
      { companyName: { $regex: String(q), $options: 'i' } },
      { email: { $regex: String(q), $options: 'i' } },
      { phone: { $regex: String(q), $options: 'i' } }
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    Vendor.find(filters)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Vendor.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// POST /vendors (accepts direct upload fields imageUrl/imagePublicId for logo)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, companyName, email, phone, address1, address2, city, zip, address, commission, imageUrl, imagePublicId } = req.body || {};
  if (!name || !companyName || !email || !phone || !address1 || !city || !zip) {
    res.status(400);
    throw new Error('name, companyName, email, phone, address1, city and zip are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const exists = await Vendor.findOne({ email: email.trim().toLowerCase() }).lean();
  if (exists) {
    res.status(409);
    throw new Error('Vendor with this email already exists');
  }

  const created = await Vendor.create({
    name: String(name).trim(),
    companyName: String(companyName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    address1: String(address1).trim(),
    address2: address2 ? String(address2).trim() : '',
    city: String(city).trim(),
    zip: String(zip).trim(),
    address: address ? String(address).trim() : '',
    commission: commission !== undefined ? Number(commission) : undefined,
    logo: imageUrl || '',
    logoPublicId: imagePublicId || ''
  });

  res.status(201).json({ success: true, data: created });
});

// PUT /vendors/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, companyName, email, phone, address1, address2, city, zip, address, commission, imageUrl, imagePublicId, status, enabled } = req.body || {};

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  if (name !== undefined) vendor.name = String(name).trim();
  if (companyName !== undefined) vendor.companyName = String(companyName).trim();
  if (email !== undefined) {
    if (!isValidEmail(email)) {
      res.status(400);
      throw new Error('Invalid email format');
    }
    vendor.email = String(email).trim().toLowerCase();
  }
  if (phone !== undefined) vendor.phone = String(phone).trim();
  if (address1 !== undefined) vendor.address1 = String(address1).trim();
  if (address2 !== undefined) vendor.address2 = String(address2).trim();
  if (city !== undefined) vendor.city = String(city).trim();
  if (zip !== undefined) vendor.zip = String(zip).trim();
  if (address !== undefined) vendor.address = String(address).trim();
  if (commission !== undefined) vendor.commission = Number(commission);
  if (status !== undefined) vendor.status = status;
  if (enabled !== undefined) vendor.enabled = Boolean(enabled);
  if (imageUrl !== undefined) vendor.logo = imageUrl;
  if (imagePublicId !== undefined) vendor.logoPublicId = imagePublicId;

  const updated = await vendor.save();
  res.json({ success: true, data: updated });
});

// PATCH /vendors/:id/status
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }
  const updated = await Vendor.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  res.json({ success: true, data: updated });
});

// PATCH /vendors/:id/enable
router.patch('/:id/enable', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body || {};
  const updated = await Vendor.findByIdAndUpdate(id, { enabled: Boolean(enabled) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  res.json({ success: true, data: updated });
});

// DELETE /vendors/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await Vendor.findByIdAndDelete(id).lean();
  if (!deleted) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  res.json({ success: true });
});

module.exports = router;