const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const VendorUser = require('../models/VendorUser');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  if (process.env.NODE_ENV !== 'production' && secret === 'dev-secret') {
    console.warn('Warning: Using default JWT secret. Set JWT_SECRET in environment for production.');
  }
  return secret;
}

function getJwtExpiry() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Try Admin login first
  const admin = await Admin.findOne({ email: normalizedEmail, $or: [{ isActive: true }, { isActive: { $exists: false } }] });
  if (admin) {
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) { res.status(401); throw new Error('Invalid credentials'); }
    const token = jwt.sign(
      { id: admin._id.toString(), role: 'admin', email: admin.email },
      getJwtSecret(),
      { expiresIn: getJwtExpiry() }
    );
    return res.json({ success: true, token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } });
  }

  // Try Vendor User login
  const vendorUser = await VendorUser.findOne({ email: normalizedEmail, isActive: true }).populate('vendor', '_id companyName enabled status').populate('vendors', '_id companyName enabled status').lean();
  if (!vendorUser) { res.status(401); throw new Error('Invalid credentials'); }
  const vendorUserDoc = await VendorUser.findOne({ email: normalizedEmail, isActive: true });
  const ok = await bcrypt.compare(password, vendorUserDoc.passwordHash);
  if (!ok) { res.status(401); throw new Error('Invalid credentials'); }

  // Migrate single vendor to vendors array if needed
  if (vendorUserDoc.vendor && (!vendorUserDoc.vendors || vendorUserDoc.vendors.length === 0)) {
    vendorUserDoc.vendors = [vendorUserDoc.vendor];
    await vendorUserDoc.save();
    console.log(`Migrated vendor user ${vendorUserDoc._id} from single vendor to vendors array`);
  }

  // Get the primary vendor (first in vendors array or single vendor)
  const primaryVendorId = vendorUserDoc.vendors && vendorUserDoc.vendors.length > 0 ? vendorUserDoc.vendors[0] : vendorUserDoc.vendor;
  const vendor = await Vendor.findById(primaryVendorId).lean();
  if (!vendor || vendor.enabled === false || vendor.status !== 'approved') {
    res.status(403);
    throw new Error('Vendor is not approved or is disabled');
  }

  const token = jwt.sign(
    { 
      id: vendorUserDoc._id.toString(), 
      role: 'vendor', 
      email: vendorUserDoc.email, 
      vendorId: vendor._id.toString(), // Keep for backward compatibility
      vendors: vendorUserDoc.vendors.map(v => v.toString()), // Add vendors array
      permissions: vendorUserDoc.permissions || [] 
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiry() }
  );

  return res.json({ 
    success: true, 
    token, 
    user: { 
      id: vendorUserDoc._id, 
      name: vendorUserDoc.name, 
      email: vendorUserDoc.email, 
      role: 'vendor', 
      vendorId: vendor._id, 
      vendorCompany: vendor.companyName, 
      vendors: vendorUserDoc.vendors,
      permissions: vendorUserDoc.permissions || [] 
    } 
  });
});

router.get('/me', authenticate, requireAdmin, async (req, res) => {
  const admin = await Admin.findById(req.user.id).lean();
  if (!admin || admin.isActive === false) {
    res.status(401);
    throw new Error('Admin not found or inactive');
  }
  res.json({
    success: true,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });
});

// Get current user permissions in real-time
router.get('/current-permissions', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      // Admin users have all permissions
      res.json({ success: true, permissions: ['*'], role: 'admin' });
    } else if (req.user.role === 'vendor') {
      // Get fresh permissions from database
      const vendorUser = await VendorUser.findById(req.user.id).populate('roleRef').lean();
      if (!vendorUser) {
        res.status(404);
        throw new Error('Vendor user not found');
      }

      let permissions = Array.isArray(vendorUser.permissions) ? vendorUser.permissions : [];
      
      // Add role permissions if roleRef exists
      if (vendorUser.roleRef && vendorUser.roleRef.permissions) {
        const rolePermissions = Array.isArray(vendorUser.roleRef.permissions) ? vendorUser.roleRef.permissions : [];
        const allPermissions = [...permissions, ...rolePermissions];
        permissions = [...new Set(allPermissions)]; // Remove duplicates
      }

      console.log(`🔍 REAL-TIME: Vendor user ${req.user.id} (${vendorUser.email}) permissions:`, permissions);
      res.json({ 
        success: true, 
        permissions,
        role: 'vendor',
        roleName: vendorUser.roleRef?.name || 'No Role',
        directPermissions: vendorUser.permissions || [],
        rolePermissions: vendorUser.roleRef?.permissions || []
      });
    } else {
      res.status(400);
      throw new Error('Invalid user role');
    }
  } catch (error) {
    console.error('❌ REAL-TIME: Error getting permissions:', error);
    res.status(500);
    throw new Error('Failed to get current permissions');
  }
});

// Refresh current user permissions
router.post('/refresh-permissions', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      // Admin users have all permissions
      res.json({ success: true, permissions: ['*'] });
    } else if (req.user.role === 'vendor') {
      // Get fresh permissions from database
      const vendorUser = await VendorUser.findById(req.user.id).populate('roleRef').lean();
      if (!vendorUser) {
        res.status(404);
        throw new Error('Vendor user not found');
      }

      let permissions = Array.isArray(vendorUser.permissions) ? vendorUser.permissions : [];
      
      // Add role permissions if roleRef exists
      if (vendorUser.roleRef && vendorUser.roleRef.permissions) {
        const rolePermissions = Array.isArray(vendorUser.roleRef.permissions) ? vendorUser.roleRef.permissions : [];
        const allPermissions = [...permissions, ...rolePermissions];
        permissions = [...new Set(allPermissions)]; // Remove duplicates
      }

      res.json({ success: true, permissions });
    } else {
      res.status(400);
      throw new Error('Invalid user role');
    }
  } catch (error) {
    res.status(500);
    throw new Error('Failed to refresh permissions');
  }
});

module.exports = router;