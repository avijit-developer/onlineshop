const express = require('express');
const User = require('../models/User');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');

const router = express.Router();

const isValidEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Admin: create a basic customer (optional; public customers use /auth/register)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, isActive } = req.body || {};

  if (!name || !email) {
    res.status(400);
    throw new Error('Both name and email are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const exists = await User.findOne({ email: String(email).toLowerCase() }).lean();
  if (exists) {
    res.status(409);
    throw new Error('Email already in use');
  }

  const user = await User.create({ name: String(name).trim(), email: String(email).trim().toLowerCase(), isActive: isActive !== undefined ? Boolean(isActive) : true });
  res.status(201).json({ success: true, data: user });
});

// Admin: list customers with search, status filter, pagination
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { q = '', status = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  
  // Only show customers (users with passwordHash for authentication)
  filters.passwordHash = { $exists: true, $ne: null };
  
  if (q) {
    const regex = new RegExp(String(q), 'i');
    filters.$or = [
      { name: { $regex: regex } },
      { email: { $regex: regex } }
    ];
  }
  if (status === 'active') filters.isActive = true;
  if (status === 'inactive') filters.isActive = false;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    User.find(filters).sort({ createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    User.countDocuments(filters)
  ]);

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// Admin: update customer status (activate/deactivate)
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body || {};
  if (isActive === undefined) {
    res.status(400);
    throw new Error('isActive is required');
  }
  const updated = await User.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ success: true, data: updated });
});

// Admin: delete customer
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if user has any orders or other dependencies before deletion
  // For now, we'll allow deletion but you might want to add checks here
  // such as checking for orders, reviews, etc.

  await User.findByIdAndDelete(id);
  res.json({ success: true, message: 'Customer deleted successfully' });
});

// Customer (self): get my addresses
router.get('/me/addresses', authenticate, requireRole(['customer']), async (req, res) => {
  const user = await User.findById(req.user.id).select('addresses').lean();
  if (!user) { res.status(404); throw new Error('User not found'); }
  res.json({ success: true, data: user.addresses || [] });
});

// Customer (self): add address
router.post('/me/addresses', authenticate, requireRole(['customer']), async (req, res) => {
  console.log('Customer add address - user:', req.user);
  console.log('Customer add address - body:', req.body);
  
  const addressData = req.body || {};
  if (!addressData.label || !addressData.address) {
    res.status(400);
    throw new Error('label and address are required');
  }
  
  // Set default values for optional fields
  addressData.city = addressData.city || '';
  addressData.state = addressData.state || '';
  addressData.zipCode = addressData.zipCode || '';
  addressData.country = addressData.country || 'United States';
  
  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  if (!user.addresses || user.addresses.length === 0) {
    addressData.isDefault = true;
  }
  if (addressData.isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }
  user.addresses.push(addressData);
  await user.save();
  res.status(201).json({ success: true, data: user.addresses });
});

// Customer (self): set default address
router.patch('/me/addresses/:addressId/default', authenticate, requireRole(['customer']), async (req, res) => {
  const { addressId } = req.params;
  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  const idx = user.addresses.findIndex(a => a._id.toString() === addressId);
  if (idx === -1) { res.status(404); throw new Error('Address not found'); }
  user.addresses.forEach(addr => addr.isDefault = false);
  user.addresses[idx].isDefault = true;
  await user.save();
  res.json({ success: true, data: user.addresses });
});

// Customer (self): update address
router.put('/me/addresses/:addressId', authenticate, requireRole(['customer']), async (req, res) => {
  const { addressId } = req.params;
  const addressData = req.body || {};

  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
  if (addressIndex === -1) { res.status(404); throw new Error('Address not found'); }

  // If this address is set as default, unset others
  if (addressData.isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  user.addresses[addressIndex] = { ...user.addresses[addressIndex].toObject(), ...addressData };
  await user.save();

  res.json({ success: true, data: user.addresses });
});

// Customer (self): delete address
router.delete('/me/addresses/:addressId', authenticate, requireRole(['customer']), async (req, res) => {
  const { addressId } = req.params;

  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
  if (addressIndex === -1) { res.status(404); throw new Error('Address not found'); }

  const deletedAddress = user.addresses[addressIndex];
  user.addresses.splice(addressIndex, 1);

  // If we deleted the default address and there are other addresses, make the first one default
  if (deletedAddress.isDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.json({ success: true, data: user.addresses });
});

// Admin: get customer addresses
router.get('/:id/addresses', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select('addresses').lean();
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ success: true, data: user.addresses || [] });
});

// Admin: add customer address
router.post('/:id/addresses', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const addressData = req.body || {};
  
  if (!addressData.label || !addressData.address) {
    res.status(400);
    throw new Error('label and address are required');
  }

  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // If this is the first address, make it default
  if (!user.addresses || user.addresses.length === 0) {
    addressData.isDefault = true;
  }

  // If this address is set as default, unset others
  if (addressData.isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  user.addresses.push(addressData);
  await user.save();

  res.status(201).json({ success: true, data: user.addresses });
});

// Admin: update customer address
router.put('/:id/addresses/:addressId', authenticate, requireAdmin, async (req, res) => {
  const { id, addressId } = req.params;
  const addressData = req.body || {};

  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
  if (addressIndex === -1) {
    res.status(404);
    throw new Error('Address not found');
  }

  // If this address is set as default, unset others
  if (addressData.isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  user.addresses[addressIndex] = { ...user.addresses[addressIndex].toObject(), ...addressData };
  await user.save();

  res.json({ success: true, data: user.addresses });
});

// Admin: delete customer address
router.delete('/:id/addresses/:addressId', authenticate, requireAdmin, async (req, res) => {
  const { id, addressId } = req.params;

  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
  if (addressIndex === -1) {
    res.status(404);
    throw new Error('Address not found');
  }

  const deletedAddress = user.addresses[addressIndex];
  user.addresses.splice(addressIndex, 1);

  // If we deleted the default address and there are other addresses, make the first one default
  if (deletedAddress.isDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.json({ success: true, data: user.addresses });
});

module.exports = router;