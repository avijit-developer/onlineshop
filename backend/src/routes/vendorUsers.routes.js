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
  const { name, email, password, vendors = [], permissions = [], roleRef } = req.body || {};
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

  let mergedPermissions = Array.isArray(permissions) ? permissions : [];
  let roleRefId = undefined;
  if (roleRef) {
    const role = await Role.findById(roleRef).lean();
    if (!role) { res.status(400); throw new Error('Role not found'); }
    const set = new Set([...(role.permissions || []), ...mergedPermissions]);
    mergedPermissions = Array.from(set);
    roleRefId = role._id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await VendorUser.create({ 
    name: String(name).trim(), 
    email: String(email).trim().toLowerCase(), 
    passwordHash, 
    vendors: vendorIds, 
    roleRef: roleRefId, 
    permissions: mergedPermissions 
  });
  res.status(201).json({ success: true, data: created });
});

// Update vendor user (admin-only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, password, vendors = [], permissions, isActive, roleRef } = req.body || {};
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
      // merge role permissions with provided permissions
      const provided = Array.isArray(permissions) ? permissions : (user.permissions || []);
      const set = new Set([...(role.permissions || []), ...provided]);
      user.permissions = Array.from(set);
    } else {
      user.roleRef = undefined;
      if (permissions !== undefined) user.permissions = Array.isArray(permissions) ? permissions : [];
    }
  } else if (permissions !== undefined) {
    user.permissions = Array.isArray(permissions) ? permissions : [];
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

// Refresh vendor user permissions (called after role updates)
router.post('/refresh-permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.body || {};
    console.log('Refreshing permissions for roleId:', roleId);
    
    let vendorUsers;
    if (roleId) {
      // Only refresh vendor users who have this specific role
      vendorUsers = await VendorUser.find({ roleRef: roleId }).populate('roleRef').lean();
      console.log(`Found ${vendorUsers.length} vendor users with role ${roleId}`);
    } else {
      // Refresh all vendor users (fallback)
      vendorUsers = await VendorUser.find({}).populate('roleRef').lean();
      console.log(`Refreshing all ${vendorUsers.length} vendor users`);
    }
    
    let updatedCount = 0;
    const affectedUserIds = [];
    
    for (const vendorUser of vendorUsers) {
      let permissions = Array.isArray(vendorUser.permissions) ? vendorUser.permissions : [];
      
      // Add role permissions if roleRef exists
      if (vendorUser.roleRef && vendorUser.roleRef.permissions) {
        const rolePermissions = Array.isArray(vendorUser.roleRef.permissions) ? vendorUser.roleRef.permissions : [];
        const allPermissions = [...permissions, ...rolePermissions];
        permissions = [...new Set(allPermissions)]; // Remove duplicates
      }
      
      // Update vendor user with merged permissions
      await VendorUser.findByIdAndUpdate(vendorUser._id, { permissions });
      updatedCount++;
      affectedUserIds.push(vendorUser._id.toString());
      
      console.log(`Updated vendor user ${vendorUser._id} with permissions:`, permissions);
    }
    
    console.log(`Refreshed permissions for ${updatedCount} vendor users`);
    res.json({ 
      success: true, 
      message: `Refreshed permissions for ${updatedCount} vendor users`,
      updatedCount,
      affectedUserIds
    });
  } catch (error) {
    console.error('Error refreshing vendor user permissions:', error);
    res.status(500);
    throw new Error('Failed to refresh vendor user permissions');
  }
});

// Invalidate specific vendor user tokens (force re-authentication for affected users)
router.post('/invalidate-specific-tokens', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.body || {};
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400);
      throw new Error('userIds array is required');
    }
    
    console.log('Invalidating tokens for specific users:', userIds);
    
    // Update specific vendor users to force token refresh
    const invalidateTimestamp = new Date();
    const result = await VendorUser.updateMany(
      { _id: { $in: userIds } }, 
      { 
        $set: { 
          tokenInvalidatedAt: invalidateTimestamp 
        } 
      }
    );
    
    console.log(`Invalidated tokens for ${result.modifiedCount} vendor users at ${invalidateTimestamp}`);
    res.json({ 
      success: true, 
      message: `Invalidated tokens for ${result.modifiedCount} vendor users`,
      invalidatedCount: result.modifiedCount,
      invalidatedAt: invalidateTimestamp
    });
  } catch (error) {
    console.error('Error invalidating specific vendor user tokens:', error);
    res.status(500);
    throw new Error('Failed to invalidate specific vendor user tokens');
  }
});

// Invalidate all vendor user tokens (force re-authentication) - kept for backward compatibility
router.post('/invalidate-tokens', authenticate, requireAdmin, async (req, res) => {
  try {
    // Get all vendor users
    const vendorUsers = await VendorUser.find({}).lean();
    
    // Update all vendor users to force token refresh
    // We'll add a timestamp that will be checked during authentication
    const invalidateTimestamp = new Date();
    await VendorUser.updateMany({}, { 
      $set: { 
        tokenInvalidatedAt: invalidateTimestamp 
      } 
    });
    
    console.log(`Invalidated tokens for ${vendorUsers.length} vendor users at ${invalidateTimestamp}`);
    res.json({ 
      success: true, 
      message: `Invalidated tokens for ${vendorUsers.length} vendor users`,
      invalidatedCount: vendorUsers.length,
      invalidatedAt: invalidateTimestamp
    });
  } catch (error) {
    console.error('Error invalidating vendor user tokens:', error);
    res.status(500);
    throw new Error('Failed to invalidate vendor user tokens');
  }
});

// Test endpoint to verify permission refresh is working
router.get('/test-permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const vendorUsers = await VendorUser.find({}).populate('roleRef').select('name email permissions roleRef').lean();
    const testData = vendorUsers.map(vu => ({
      id: vu._id,
      name: vu.name,
      email: vu.email,
      permissions: vu.permissions,
      roleName: vu.roleRef?.name || 'No Role',
      rolePermissions: vu.roleRef?.permissions || []
    }));
    
    res.json({ 
      success: true, 
      message: 'Permission test data',
      vendorUsers: testData
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500);
    throw new Error('Failed to get test data');
  }
});

module.exports = router;