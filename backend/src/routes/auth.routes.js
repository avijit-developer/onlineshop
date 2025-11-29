const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const VendorUser = require('../models/VendorUser');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const DriverUser = require('../models/DriverUser');
const Driver = require('../models/Driver');
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
  const { email, phone, password } = req.body || {};

  if (!password || (!email && !phone)) {
    res.status(400);
    throw new Error('Email or phone and password are required');
  }

  // If email is provided, validate it and try email-based login flow first
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  if (normalizedEmail) {
    // Try Admin login first (email-only)
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

    // Driver User by email
    const driverUser = await DriverUser.findOne({ email: normalizedEmail, isActive: true });
    if (driverUser) {
      const ok = await bcrypt.compare(password, driverUser.passwordHash);
      if (!ok) { res.status(401); throw new Error('Invalid credentials'); }
      const token = jwt.sign(
        { id: driverUser._id.toString(), role: 'driver', email: driverUser.email, driverId: driverUser.driver ? driverUser.driver.toString() : undefined },
        getJwtSecret(),
        { expiresIn: getJwtExpiry() }
      );
      return res.json({ success: true, token, user: { id: driverUser._id, name: driverUser.name, email: driverUser.email, role: 'driver', driverId: driverUser.driver } });
    }

    // Vendor User by email
    const vendorUser = await VendorUser.findOne({ email: normalizedEmail, isActive: true }).populate('vendor', '_id companyName enabled status').populate('vendors', '_id companyName enabled status');
    if (vendorUser) {
      const ok = await bcrypt.compare(password, vendorUser.passwordHash);
      if (!ok) { res.status(401); throw new Error('Invalid credentials'); }

      // Migrate single vendor to vendors array if needed
      if (vendorUser.vendor && (!vendorUser.vendors || vendorUser.vendors.length === 0)) {
        vendorUser.vendors = [vendorUser.vendor];
        await vendorUser.save();
        console.log(`Migrated vendor user ${vendorUser._id} from single vendor to vendors array`);
      }

      // Get the primary vendor (first in vendors array or single vendor)
      const primaryVendorId = vendorUser.vendors && vendorUser.vendors.length > 0 ? vendorUser.vendors[0] : vendorUser.vendor;
      const vendor = await Vendor.findById(primaryVendorId).lean();
      const vendorStatus = typeof vendor?.status === 'string' ? vendor.status.toLowerCase() : '';
      if (!vendor || vendor.enabled === false || vendorStatus !== 'approved') {
        res.status(403);
        throw new Error('Vendor is not approved or is disabled');
      }

      // Merge role permissions for immediate correctness
      const populatedVu = await VendorUser.findById(vendorUser._id).populate('roleRef').lean();
      const mergedPermissions = Array.from(new Set([
        ...(Array.isArray(populatedVu?.roleRef?.permissions) ? populatedVu.roleRef.permissions : [])
      ]));

      // Normalize vendors array to string ids
      const vendorIdList = Array.isArray(vendorUser.vendors)
        ? vendorUser.vendors.map(v => (v && v._id ? v._id.toString() : String(v)))
        : [];
      const token = jwt.sign(
        { 
          id: vendorUser._id.toString(), 
          role: 'vendor', 
          email: vendorUser.email, 
          vendorId: vendor._id.toString(),
          vendors: vendorIdList,
          permissions: mergedPermissions 
        },
        getJwtSecret(),
        { expiresIn: getJwtExpiry() }
      );

      return res.json({ 
        success: true, 
        token, 
        user: { 
          id: vendorUser._id, 
          name: vendorUser.name, 
          email: vendorUser.email, 
          role: 'vendor', 
          vendorId: vendor._id, 
          vendorCompany: vendor.companyName, 
          vendors: vendorUser.vendors,
          permissions: mergedPermissions 
        } 
      });
    }

    // Customer by email
    const customerByEmail = await User.findOne({ email: normalizedEmail, isActive: true });
    if (customerByEmail && customerByEmail.passwordHash) {
      const ok = await bcrypt.compare(password, customerByEmail.passwordHash);
      if (!ok) { res.status(401); throw new Error('Invalid credentials'); }
      const token = jwt.sign(
        { id: customerByEmail._id.toString(), role: 'customer', email: customerByEmail.email },
        getJwtSecret(),
        { expiresIn: getJwtExpiry() }
      );
      return res.json({ success: true, token, user: { id: customerByEmail._id, name: customerByEmail.name, email: customerByEmail.email, phone: customerByEmail.phone, avatar: customerByEmail.avatar, role: 'customer' } });
    }
    // If email was provided but no match, fall through to phone if provided
  }

  // Phone-based login (admin, customer, driver, vendor)
  const phoneNorm = String(phone || '').trim();
  if (phoneNorm) {
    // Admin by phone
    const adminByPhone = await Admin.findOne({ phone: phoneNorm, $or: [{ isActive: true }, { isActive: { $exists: false } }] });
    if (adminByPhone) {
      const ok = await bcrypt.compare(password, adminByPhone.passwordHash);
      if (ok) {
        const token = jwt.sign(
          { id: adminByPhone._id.toString(), role: 'admin', email: adminByPhone.email },
          getJwtSecret(),
          { expiresIn: getJwtExpiry() }
        );
        return res.json({ success: true, token, user: { id: adminByPhone._id, name: adminByPhone.name, email: adminByPhone.email, phone: adminByPhone.phone, role: 'admin' } });
      }
    }

    // Vendor user directly by phone
    const vendorUserByPhone = await VendorUser.findOne({ phone: phoneNorm, isActive: true })
      .populate('vendor', '_id companyName enabled status')
      .populate('vendors', '_id companyName enabled status');
    if (vendorUserByPhone) {
      const ok = await bcrypt.compare(password, vendorUserByPhone.passwordHash);
      if (ok) {
        const primaryVendorId = vendorUserByPhone.vendors && vendorUserByPhone.vendors.length > 0
          ? vendorUserByPhone.vendors[0]
          : vendorUserByPhone.vendor;
        const vendor = primaryVendorId ? await Vendor.findById(primaryVendorId).lean() : null;
        const vendorStatus = typeof vendor?.status === 'string' ? vendor.status.toLowerCase() : '';
        if (!vendor || vendor.enabled === false || vendorStatus !== 'approved') {
          res.status(403);
          throw new Error('Vendor is not approved or is disabled');
        }

        const populatedVu = await VendorUser.findById(vendorUserByPhone._id).populate('roleRef').lean();
        const mergedPermissions = Array.from(new Set([
          ...(Array.isArray(populatedVu?.roleRef?.permissions) ? populatedVu.roleRef.permissions : [])
        ]));

        const vendorIdList = Array.isArray(vendorUserByPhone.vendors)
          ? vendorUserByPhone.vendors.map(v => (v && v._id ? v._id.toString() : String(v)))
          : [];

        const token = jwt.sign(
          {
            id: vendorUserByPhone._id.toString(),
            role: 'vendor',
            email: vendorUserByPhone.email,
            vendorId: vendor._id.toString(),
            vendors: vendorIdList,
            permissions: mergedPermissions
          },
          getJwtSecret(),
          { expiresIn: getJwtExpiry() }
        );

        return res.json({
          success: true,
          token,
          user: {
            id: vendorUserByPhone._id,
            name: vendorUserByPhone.name,
            email: vendorUserByPhone.email,
            phone: vendorUserByPhone.phone,
            role: 'vendor',
            vendorId: vendor._id,
            vendorCompany: vendor.companyName,
            vendors: vendorUserByPhone.vendors,
            permissions: mergedPermissions
          }
        });
      }
    }

    // Customer by phone
    const customerByPhone = await User.findOne({ phone: phoneNorm, isActive: true });
    if (customerByPhone && customerByPhone.passwordHash) {
      const ok = await bcrypt.compare(password, customerByPhone.passwordHash);
      if (ok) {
        const token = jwt.sign(
          { id: customerByPhone._id.toString(), role: 'customer', email: customerByPhone.email },
          getJwtSecret(),
          { expiresIn: getJwtExpiry() }
        );
        return res.json({ success: true, token, user: { id: customerByPhone._id, name: customerByPhone.name, email: customerByPhone.email, phone: customerByPhone.phone, avatar: customerByPhone.avatar, role: 'customer' } });
      }
    }

    // Driver by phone -> DriverUser by email
    const driver = await Driver.findOne({ phone: phoneNorm }).lean();
    if (driver) {
      const driverUser = await DriverUser.findOne({ email: String(driver.email || '').trim().toLowerCase(), isActive: true });
      if (driverUser) {
        const ok = await bcrypt.compare(password, driverUser.passwordHash);
        if (ok) {
          const token = jwt.sign(
            { id: driverUser._id.toString(), role: 'driver', email: driverUser.email, driverId: driverUser.driver ? driverUser.driver.toString() : undefined },
            getJwtSecret(),
            { expiresIn: getJwtExpiry() }
          );
          return res.json({ success: true, token, user: { id: driverUser._id, name: driverUser.name, email: driverUser.email, role: 'driver', driverId: driverUser.driver } });
        }
      }
    }

    // Vendor by phone -> VendorUser by vendor email
    const vendor = await Vendor.findOne({ phone: phoneNorm }).lean();
    if (vendor) {
      const vendorEmail = String(vendor.email || '').trim().toLowerCase();
      if (vendorEmail && isValidEmail(vendorEmail)) {
        const vendorUser = await VendorUser.findOne({ email: vendorEmail, isActive: true }).populate('vendor', '_id companyName enabled status').populate('vendors', '_id companyName enabled status');
        if (vendorUser) {
          const ok = await bcrypt.compare(password, vendorUser.passwordHash);
          if (ok) {
            // Ensure vendor status is approved/enabled
            const primaryVendorId = vendorUser.vendors && vendorUser.vendors.length > 0 ? vendorUser.vendors[0] : vendorUser.vendor;
            const v = await Vendor.findById(primaryVendorId).lean();
            const vendorStatus = typeof v?.status === 'string' ? v.status.toLowerCase() : '';
            if (!v || v.enabled === false || vendorStatus !== 'approved') {
              res.status(403);
              throw new Error('Vendor is not approved or is disabled');
            }
            const populatedVu = await VendorUser.findById(vendorUser._id).populate('roleRef').lean();
            const mergedPermissions = Array.from(new Set([
              ...(Array.isArray(populatedVu?.roleRef?.permissions) ? populatedVu.roleRef.permissions : [])
            ]));
          const token = jwt.sign(
            { id: vendorUser._id.toString(), role: 'vendor', email: vendorUser.email, vendorId: v._id.toString(), vendors: (Array.isArray(vendorUser.vendors) ? vendorUser.vendors.map(x => (x && x._id ? x._id.toString() : String(x))) : []), permissions: mergedPermissions },
              getJwtSecret(),
              { expiresIn: getJwtExpiry() }
            );
            return res.json({ success: true, token, user: { id: vendorUser._id, name: vendorUser.name, email: vendorUser.email, role: 'vendor', vendorId: v._id, vendorCompany: v.companyName, vendors: vendorUser.vendors, permissions: mergedPermissions } });
          }
        }
      }
    }
  }

  res.status(401);
  throw new Error('Invalid credentials');
});

// START OTP RESET (admin + customer)
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) { res.status(400); throw new Error('Valid email is required'); }
  const normalizedEmail = String(email).trim().toLowerCase();
  // search admin -> vendor user -> customer
  let user = await Admin.findOne({ email: normalizedEmail });
  let userType = 'admin';
  if (!user) { user = await VendorUser.findOne({ email: normalizedEmail }); userType = 'vendor'; }
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
  if (!user) { user = await VendorUser.findOne({ email: normalizedEmail }); userType = 'vendor'; }
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
  if (!user) { user = await VendorUser.findOne({ email: normalizedEmail }); isAdmin = false; }
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
  if (!name || !email || !password || !phone) {
    res.status(400);
    throw new Error('name, email, phone and password are required');
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
  // Check phone uniqueness if provided
  const phoneNorm = String(phone).trim();
  if (phoneNorm) {
    const [userPhone, vendorPhone, driverPhone] = await Promise.all([
      User.findOne({ phone: phoneNorm }).lean(),
      Vendor.findOne({ phone: phoneNorm }).lean(),
      Driver.findOne({ phone: phoneNorm }).lean()
    ]);
    if (userPhone || vendorPhone || driverPhone) {
      res.status(409);
      throw new Error('Phone number already in use');
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await User.create({ 
    name: String(name).trim(), 
    email: String(email).trim().toLowerCase(), 
    phone: String(phone).trim(),
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

// Change password (admin or vendor)
router.patch('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) { res.status(400); throw new Error('currentPassword and newPassword are required'); }
    if (String(newPassword).length < 8) { res.status(400); throw new Error('New password must be at least 8 characters'); }
    if (req.user.role === 'admin') {
      const admin = await Admin.findById(req.user.id);
      if (!admin) { res.status(404); throw new Error('User not found'); }
      const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!ok) { res.status(401); throw new Error('Current password is incorrect'); }
      admin.passwordHash = await bcrypt.hash(String(newPassword), 10);
      await admin.save();
      return res.json({ success: true });
    } else if (req.user.role === 'vendor') {
      const vu = await VendorUser.findById(req.user.id);
      if (!vu) { res.status(404); throw new Error('User not found'); }
      const ok = await bcrypt.compare(currentPassword, vu.passwordHash);
      if (!ok) { res.status(401); throw new Error('Current password is incorrect'); }
      vu.passwordHash = await bcrypt.hash(String(newPassword), 10);
      await vu.save();
      return res.json({ success: true });
    } else if (req.user.role === 'driver') {
      const du = await DriverUser.findById(req.user.id);
      if (!du) { res.status(404); throw new Error('User not found'); }
      const ok = await bcrypt.compare(currentPassword, du.passwordHash);
      if (!ok) { res.status(401); throw new Error('Current password is incorrect'); }
      du.passwordHash = await bcrypt.hash(String(newPassword), 10);
      await du.save();
      return res.json({ success: true });
    } else {
      res.status(400);
      throw new Error('Unsupported role for password change');
    }
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

module.exports = router;