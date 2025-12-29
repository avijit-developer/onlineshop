const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Driver = require('../models/Driver');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');
const { uploadImageBuffer, deleteImageByPublicId } = require('../config/cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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
      { email: { $regex: regex } },
      { phone: { $regex: regex } }
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

// Customer (self): delete my account (must be BEFORE any '/:id' routes)
router.delete('/me', authenticate, requireRole(['customer']), async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  // Clean up avatar from Cloudinary if present
  if (user.avatarPublicId) {
    try { await deleteImageByPublicId(user.avatarPublicId); } catch (_) {}
  }

  await User.findByIdAndDelete(req.user.id);
  return res.json({ success: true, message: 'Account deleted successfully' });
});

// Admin: update customer status (activate/deactivate) - Must come before /:id route
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

// Admin: update customer
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, password } = req.body || {};
  
  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Validate email if provided
  if (email !== undefined) {
    if (!isValidEmail(email)) {
      res.status(400);
      throw new Error('Invalid email format');
    }
    
    // Check if email is already in use by another user
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        res.status(409);
        throw new Error('Email already in use');
      }
    }
    user.email = String(email).trim().toLowerCase();
  }

  // Check if phone is already in use by another user
  if (phone !== undefined) {
    const phoneNorm = String(phone).trim();
    if (phoneNorm && phoneNorm !== (user.phone || '').trim()) {
      const [userPhone, vendorPhone, driverPhone] = await Promise.all([
        User.findOne({ phone: phoneNorm, _id: { $ne: user._id } }),
        Vendor.findOne({ phone: phoneNorm }),
        Driver.findOne({ phone: phoneNorm }),
      ]);
      if (userPhone || vendorPhone || driverPhone) {
        res.status(409);
        throw new Error('Phone number already in use');
      }
    }
    user.phone = phoneNorm || undefined;
  }

  if (name !== undefined) user.name = String(name).trim();

  // Update password if provided
  if (password !== undefined && password !== '') {
    if (String(password).length < 8) {
      res.status(400);
      throw new Error('Password must be at least 8 characters');
    }
    user.passwordHash = await bcrypt.hash(String(password), 10);
  }

  const updated = await user.save();
  const userObj = updated.toObject();
  delete userObj.passwordHash;
  res.json({ success: true, data: userObj });
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
  
  // Handle firstName/lastName combination for the required name field
  if (addressData.firstName || addressData.lastName) {
    addressData.name = `${addressData.firstName || ''} ${addressData.lastName || ''}`.trim();
  } else if (!addressData.name) {
    res.status(400);
    throw new Error('name is required (or provide firstName and lastName)');
  }
  
  // Set default values for optional fields
  addressData.city = addressData.city || '';
  addressData.state = addressData.state || '';
  addressData.zipCode = addressData.zipCode || '';
  addressData.country = addressData.country || 'United States';
  
  // Handle location coordinates if latitude/longitude provided
  if (addressData.latitude != null && addressData.longitude != null) {
    addressData.location = {
      type: 'Point',
      coordinates: [Number(addressData.longitude), Number(addressData.latitude)] // [lon, lat] format for MongoDB
    };
  }
  
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

// Customer (self): delete my account
router.delete('/me', authenticate, requireRole(['customer']), async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  // Clean up avatar from Cloudinary if present
  if (user.avatarPublicId) {
    try { await deleteImageByPublicId(user.avatarPublicId); } catch (_) {}
  }

  await User.findByIdAndDelete(req.user.id);
  return res.json({ success: true, message: 'Account deleted successfully' });
});

// Customer (self): set default address
router.patch('/me/addresses/:addressId/default', authenticate, requireRole(['customer']), async (req, res) => {
  const { addressId } = req.params;
  
  // Validate addressId format
  if (!addressId || addressId.trim() === '') {
    res.status(400);
    throw new Error('Address ID is required');
  }
  
  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  
  const idx = user.addresses.findIndex(a => a._id.toString() === addressId);
  if (idx === -1) { 
    res.status(404); 
    throw new Error(`Address with ID '${addressId}' not found. Please ensure the address exists and try again.`); 
  }
  
  user.addresses.forEach(addr => addr.isDefault = false);
  user.addresses[idx].isDefault = true;
  await user.save();
  res.json({ success: true, data: user.addresses });
});

// Customer (self): update address
router.put('/me/addresses/:addressId', authenticate, requireRole(['customer']), async (req, res) => {
  const { addressId } = req.params;
  const addressData = req.body || {};

  // Validate addressId format
  if (!addressId || addressId.trim() === '') {
    res.status(400);
    throw new Error('Address ID is required');
  }

  // Handle firstName/lastName combination for the name field
  if (addressData.firstName || addressData.lastName) {
    addressData.name = `${addressData.firstName || ''} ${addressData.lastName || ''}`.trim();
  }

  // Handle location coordinates if latitude/longitude provided
  if (addressData.latitude != null && addressData.longitude != null) {
    addressData.location = {
      type: 'Point',
      coordinates: [Number(addressData.longitude), Number(addressData.latitude)] // [lon, lat] format for MongoDB
    };
  }

  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
  if (addressIndex === -1) { 
    res.status(404); 
    throw new Error(`Address with ID '${addressId}' not found. Please ensure the address exists and try again.`); 
  }

  // If this address is set as default, unset others
  if (addressData.isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  user.addresses[addressIndex] = { ...user.addresses[addressIndex].toObject(), ...addressData };
  await user.save();

  res.json({ success: true, data: user.addresses });
});

// Customer (self): update profile
router.put('/me/profile', authenticate, requireRole(['customer']), async (req, res) => {
  const { name, email, phone, avatar } = req.body || {};
  
  const user = await User.findById(req.user.id);
  if (!user) { 
    res.status(404); 
    throw new Error('User not found'); 
  }

  // Validate email if provided
  if (email && !isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  // Check if email is already in use by another user
  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409);
      throw new Error('Email already in use');
    }
  }

  // Check if phone is already in use by another user
  if (phone && String(phone).trim() !== (user.phone || '').trim()) {
    const phoneNorm = String(phone).trim();
    const [userPhone, vendorPhone, driverPhone] = await Promise.all([
      User.findOne({ phone: phoneNorm, _id: { $ne: user._id } }),
      Vendor.findOne({ phone: phoneNorm }),
      Driver.findOne({ phone: phoneNorm }),
    ]);
    if (userPhone || vendorPhone || driverPhone) {
      res.status(409);
      throw new Error('Phone number already in use');
    }
  }

  // Update user fields
  const updateData = {};
  if (name !== undefined) updateData.name = String(name).trim();
  if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
  if (phone !== undefined) updateData.phone = String(phone).trim();
  if (avatar !== undefined) updateData.avatar = String(avatar).trim();

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id, 
    updateData, 
    { new: true, runValidators: true }
  ).select('-passwordHash');

  res.json({ success: true, data: updatedUser });
});

// Customer (self): upload profile picture
router.post('/me/avatar', authenticate, requireRole(['customer']), upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No image file provided');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Delete old avatar from Cloudinary if it exists
    if (user.avatarPublicId) {
      await deleteImageByPublicId(user.avatarPublicId);
    }

    // Upload new image to Cloudinary
    let uploaded = null;
    try {
      uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, 'avatars');
    } catch (e) {
      throw new Error(`Cloudinary upload failed: ${e?.message || e}`);
    }

    // Update user with new avatar
    user.avatar = uploaded.url;
    user.avatarPublicId = uploaded.publicId;
    await user.save();

    res.json({ 
      success: true, 
      data: { 
        avatar: user.avatar,
        avatarPublicId: user.avatarPublicId 
      } 
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500);
    throw new Error(error.message || 'Failed to upload profile picture');
  }
});

// Customer (self): delete profile picture
router.delete('/me/avatar', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Delete avatar from Cloudinary if it exists
    if (user.avatarPublicId) {
      await deleteImageByPublicId(user.avatarPublicId);
    }

    // Remove avatar from user
    user.avatar = undefined;
    user.avatarPublicId = undefined;
    await user.save();

    res.json({ success: true, message: 'Profile picture removed successfully' });
  } catch (error) {
    console.error('Profile picture deletion error:', error);
    res.status(500);
    throw new Error(error.message || 'Failed to remove profile picture');
  }
});

// Customer (self): delete address
router.delete('/me/addresses/:addressId', authenticate, requireRole(['customer']), async (req, res) => {
  const { addressId } = req.params;

  // Validate addressId format
  if (!addressId || addressId.trim() === '') {
    res.status(400);
    throw new Error('Address ID is required');
  }

  const user = await User.findById(req.user.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
  if (addressIndex === -1) { 
    res.status(404); 
    throw new Error(`Address with ID '${addressId}' not found. Please ensure the address exists and try again.`); 
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

  // Handle firstName/lastName combination for the name field
  if (addressData.firstName || addressData.lastName) {
    addressData.name = `${addressData.firstName || ''} ${addressData.lastName || ''}`.trim();
  } else if (!addressData.name) {
    res.status(400);
    throw new Error('name is required (or provide firstName and lastName)');
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

  // Handle location coordinates if latitude/longitude provided
  if (addressData.latitude != null && addressData.longitude != null) {
    addressData.location = {
      type: 'Point',
      coordinates: [Number(addressData.longitude), Number(addressData.latitude)] // [lon, lat] format for MongoDB
    };
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

// Customer (self): get my wishlist
router.get('/me/wishlist', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'wishlist',
        select: '_id name description price regularPrice specialPrice productType images category brand isActive',
        match: { isActive: true }
      })
      .lean();

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({ success: true, data: user.wishlist || [] });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500);
    throw new Error('Failed to fetch wishlist');
  }
});

// Customer (self): add product to wishlist
router.post('/me/wishlist/:productId', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate productId format
    if (!productId || !require('mongoose').Types.ObjectId.isValid(productId)) {
      res.status(400);
      throw new Error('Invalid product ID');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Check if product is already in wishlist
    if (user.wishlist.includes(productId)) {
      res.status(409);
      throw new Error('Product already in wishlist');
    }

    // Add product to wishlist
    user.wishlist.push(productId);
    await user.save();

    res.status(201).json({ 
      success: true, 
      message: 'Product added to wishlist',
      data: { productId }
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500);
    throw new Error(error.message || 'Failed to add product to wishlist');
  }
});

// Customer (self): remove product from wishlist
router.delete('/me/wishlist/:productId', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate productId format
    if (!productId || !require('mongoose').Types.ObjectId.isValid(productId)) {
      res.status(400);
      throw new Error('Invalid product ID');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Remove product from wishlist
    const initialLength = user.wishlist.length;
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    
    if (user.wishlist.length === initialLength) {
      res.status(404);
      throw new Error('Product not found in wishlist');
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Product removed from wishlist',
      data: { productId }
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500);
    throw new Error(error.message || 'Failed to remove product from wishlist');
  }
});

// Customer (self): check if product is in wishlist
router.get('/me/wishlist/check/:productId', authenticate, requireRole(['customer']), async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate productId format
    if (!productId || !require('mongoose').Types.ObjectId.isValid(productId)) {
      res.status(400);
      throw new Error('Invalid product ID');
    }

    const user = await User.findById(req.user.id).select('wishlist').lean();
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const isInWishlist = user.wishlist.some(id => id.toString() === productId);

    res.json({ 
      success: true, 
      data: { isInWishlist }
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500);
    throw new Error(error.message || 'Failed to check wishlist status');
  }
});

module.exports = router;