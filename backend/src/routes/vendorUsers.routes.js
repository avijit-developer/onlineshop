const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');
const VendorUser = require('../models/VendorUser');
const Vendor = require('../models/Vendor');
const Role = require('../models/Role');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// List vendor users (admin-only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { vendor, q = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  if (vendor) filters.vendor = vendor;
  if (q) {
    filters.$or = [
      { name: { $regex: String(q), $options: 'i' } },
      { email: { $regex: String(q), $options: 'i' } }
    ];
  }
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    VendorUser.find(filters).populate('vendors', 'companyName').populate('vendor', 'companyName').populate('roleRef','name').skip((pageNum - 1) * perPage).limit(perPage).lean(),
    VendorUser.countDocuments(filters)
  ]);
  
  // Process items to handle both single vendor and multiple vendors
  const processedItems = items.map(item => {
    // If user has vendors array, use that; otherwise, convert single vendor to array
    if (item.vendors && item.vendors.length > 0) {
      return item;
    } else if (item.vendor) {
      return {
        ...item,
        vendors: [item.vendor],
        vendor: undefined // Remove single vendor to avoid confusion
      };
    } else {
      return {
        ...item,
        vendors: []
      };
    }
  });
  
  res.json({ success: true, data: processedItems, meta: { total, page: pageNum, limit: perPage } });
});

// Create vendor user (admin-only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password, vendors = [], roleRef } = req.body || {};
  if (!name || !email || !password || !vendors.length) {
    res.status(400);
    throw new Error('name, email, password and at least one vendor are required');
  }
  if (!isValidEmail(email)) { res.status(400); throw new Error('Invalid email format'); }
  if (String(password).length < 8) { res.status(400); throw new Error('Password must be at least 8 characters'); }
  
  // Validate all vendors exist
  const vendorIds = Array.isArray(vendors) ? vendors : [vendors];
  const existingVendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
  if (existingVendors.length !== vendorIds.length) {
    res.status(400); throw new Error('One or more vendors not found');
  }

  const exists = await VendorUser.findOne({ email: email.trim().toLowerCase() }).lean();
  if (exists) { res.status(409); throw new Error('Email already in use'); }

  let roleRefId = undefined;
  if (roleRef) {
    const role = await Role.findById(roleRef).lean();
    if (!role) { res.status(400); throw new Error('Role not found'); }
    roleRefId = role._id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await VendorUser.create({ 
    name: String(name).trim(), 
    email: String(email).trim().toLowerCase(), 
    passwordHash, 
    vendors: vendorIds, 
    roleRef: roleRefId
  });
  res.status(201).json({ success: true, data: created });
});

// Update vendor user (admin-only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, password, vendors = [], isActive, roleRef } = req.body || {};
  const user = await VendorUser.findById(id);
  if (!user) { res.status(404); throw new Error('vendor user not found'); }
  if (name !== undefined) user.name = String(name).trim();
  if (email !== undefined) {
    if (!isValidEmail(email)) { res.status(400); throw new Error('Invalid email format'); }
    user.email = String(email).trim().toLowerCase();
  }
  if (password !== undefined) {
    if (String(password).length < 8) { res.status(400); throw new Error('Password must be at least 8 characters'); }
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  if (vendors !== undefined) {
    const vendorIds = Array.isArray(vendors) ? vendors : [vendors];
    if (vendorIds.length > 0) {
      const existingVendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
      if (existingVendors.length !== vendorIds.length) {
        res.status(400); throw new Error('One or more vendors not found');
      }
    }
    user.vendors = vendorIds;
  }
  if (roleRef !== undefined) {
    if (roleRef) {
      const role = await Role.findById(roleRef).lean();
      if (!role) { res.status(400); throw new Error('Role not found'); }
      user.roleRef = roleRef;
    } else {
      user.roleRef = undefined;
    }
  }
  if (isActive !== undefined) user.isActive = Boolean(isActive);

  const updated = await user.save();
  res.json({ success: true, data: updated });
});

// Delete vendor user (admin-only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const deleted = await VendorUser.findByIdAndDelete(id).lean();
  if (!deleted) { res.status(404); throw new Error('vendor user not found'); }
  res.json({ success: true });
});

// Note: Legacy permission maintenance endpoints removed. Permissions are now derived at runtime from role assignment.

module.exports = router;