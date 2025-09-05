const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const VendorUser = require('../models/VendorUser');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendMail, buildEmailHtml } = require('../utils/mailer');

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
  if (vendorUser) {
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

  // Merge role permissions for immediate correctness
  const populatedVu = await VendorUser.findById(vendorUserDoc._id).populate('roleRef').lean();
  const mergedPermissions = Array.from(new Set([...
    (Array.isArray(populatedVu?.roleRef?.permissions) ? populatedVu.roleRef.permissions : [])
  ]));

  const token = jwt.sign(
    { 
      id: vendorUserDoc._id.toString(), 
      role: 'vendor', 
      email: vendorUserDoc.email, 
      vendorId: vendor._id.toString(), // Keep for backward compatibility
      vendors: vendorUserDoc.vendors.map(v => v.toString()), // Add vendors array
      permissions: mergedPermissions 
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
        permissions: mergedPermissions 
      } 
    });
  }

  // Fallback to customer login
  const customer = await User.findOne({ email: normalizedEmail, isActive: true });
  if (!customer || !customer.passwordHash) {
    res.status(401);
    throw new Error('Invalid credentials');
  }
  const ok = await bcrypt.compare(password, customer.passwordHash);
  if (!ok) { res.status(401); throw new Error('Invalid credentials'); }

  const token = jwt.sign(
    { id: customer._id.toString(), role: 'customer', email: customer.email },
    getJwtSecret(),
    { expiresIn: getJwtExpiry() }
  );

  return res.json({ 
    success: true, 
    token, 
    user: { 
      id: customer._id, 
      name: customer.name, 
      email: customer.email, 
      phone: customer.phone,
      avatar: customer.avatar,
      role: 'customer' 
    } 
  });
});

// START OTP RESET (admin + customer)
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) { res.status(400); throw new Error('Valid email is required'); }
  const normalizedEmail = String(email).trim().toLowerCase();
  // search admin first, then customer
  let user = await Admin.findOne({ email: normalizedEmail });
  let userType = 'admin';
  if (!user) { user = await User.findOne({ email: normalizedEmail }); userType = 'customer'; }
  if (!user) { res.status(404); throw new Error('No account found with this email'); }
  const otp = generateOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  user.resetOtp = otp;
  user.resetOtpExpiresAt = expires;
  await user.save();
  try {
    const html = await buildEmailHtml({ subject: 'Your OTP Code', contentHtml: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>` });
    await sendMail({ to: normalizedEmail, subject: 'OTP Verification', html });
  } catch (_) {}
  res.json({ success: true });
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) { res.status(400); throw new Error('email and otp are required'); }
  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await Admin.findOne({ email: normalizedEmail });
  let userType = 'admin';
  if (!user) { user = await User.findOne({ email: normalizedEmail }); userType = 'customer'; }
  if (!user || !user.resetOtp || !user.resetOtpExpiresAt) { res.status(400); throw new Error('OTP not requested'); }
  if (String(user.resetOtp) !== String(otp)) { res.status(400); throw new Error('Invalid OTP'); }
  if (new Date(user.resetOtpExpiresAt) < new Date()) { res.status(400); throw new Error('OTP expired'); }
  res.json({ success: true });
});

router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) { res.status(400); throw new Error('email, otp and newPassword are required'); }
  if (String(newPassword).length < 6) { res.status(400); throw new Error('Password must be at least 6 characters'); }
  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await Admin.findOne({ email: normalizedEmail });
  let isAdmin = true;
  if (!user) { user = await User.findOne({ email: normalizedEmail }); isAdmin = false; }
  if (!user || !user.resetOtp || !user.resetOtpExpiresAt) { res.status(400); throw new Error('OTP not requested'); }
  if (String(user.resetOtp) !== String(otp)) { res.status(400); throw new Error('Invalid OTP'); }
  if (new Date(user.resetOtpExpiresAt) < new Date()) { res.status(400); throw new Error('OTP expired'); }
  const hash = await bcrypt.hash(String(newPassword), 10);
  user.passwordHash = hash;
  user.resetOtp = '';
  user.resetOtpExpiresAt = null;
  await user.save();
  res.json({ success: true });
});
// END OTP RESET

// Public customer registration
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email and password are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const exists = await User.findOne({ email: email.trim().toLowerCase() }).lean();
  if (exists) { res.status(409); throw new Error('Email already in use'); }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await User.create({ 
    name: String(name).trim(), 
    email: String(email).trim().toLowerCase(), 
    phone: phone ? String(phone).trim() : undefined,
    passwordHash 
  });

  const token = jwt.sign(
    { id: created._id.toString(), role: 'customer', email: created.email },
    getJwtSecret(),
    { expiresIn: getJwtExpiry() }
  );

  res.status(201).json({ 
    success: true, 
    token, 
    user: { 
      id: created._id, 
      name: created.name, 
      email: created.email, 
      phone: created.phone,
      avatar: created.avatar,
      role: 'customer' 
    } 
  });
});

// Customer: get my profile
router.get('/me', authenticate, async (req, res) => {
  if (req.user.role === 'customer') {
    const customer = await User.findById(req.user.id).lean();
    if (!customer || customer.isActive === false) {
      res.status(401);
      throw new Error('Customer not found or inactive');
    }
    res.json({
      success: true,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
        role: 'customer'
      }
    });
  } else if (req.user.role === 'admin') {
    // Admin profile endpoint
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
  } else {
    res.status(400);
    throw new Error('Invalid user role');
  }
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

      // Role-only permissions
      const permissions = Array.isArray(vendorUser?.roleRef?.permissions)
        ? vendorUser.roleRef.permissions
        : [];

      console.log(`🔍 REAL-TIME: Vendor user ${req.user.id} (${vendorUser.email}) permissions:`, permissions);
      res.json({ 
        success: true, 
        permissions,
        role: 'vendor',
        roleName: vendorUser.roleRef?.name || 'No Role',
        directPermissions: [],
        rolePermissions: permissions
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