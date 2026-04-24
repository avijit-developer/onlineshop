const jwt = require('jsonwebtoken');
const DriverUser = require('../models/DriverUser');
const Driver = require('../models/Driver');
const VendorUser = require('../models/VendorUser');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  if (process.env.NODE_ENV !== 'production' && secret === 'dev-secret') {
    console.warn('Warning: Using default JWT secret. Set JWT_SECRET in environment for production.');
  }
  return secret;
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401);
    return next(new Error('Authentication token missing'));
  }
  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (payload.role === 'driver' && !payload.driverId) {
      try {
        const driverUser = await DriverUser.findById(payload.id).select('driver email name').lean();
        if (driverUser?.driver) {
          payload.driverId = String(driverUser.driver);
        } else if (driverUser?.email) {
          const driver = await Driver.findOne({ email: String(driverUser.email).trim().toLowerCase() }).select('_id').lean();
          if (driver?._id) payload.driverId = String(driver._id);
        } else if (driverUser?.name) {
          const driver = await Driver.findOne({ name: String(driverUser.name).trim() }).select('_id').lean();
          if (driver?._id) payload.driverId = String(driver._id);
        }
      } catch (driverResolveErr) {
        console.warn('Failed to resolve driver context during auth:', driverResolveErr?.message || driverResolveErr);
      }
    }
    
    // Check if token is invalidated for vendor users
    if (payload.role === 'vendor') {
      const vendorUser = await VendorUser.findById(payload.id).select({ tokenInvalidatedAt: 1 }).lean();
      if (vendorUser && vendorUser.tokenInvalidatedAt) {
        // Check if token was issued before invalidation
        const tokenIssuedAt = payload.iat ? new Date(payload.iat * 1000) : new Date(0);
        if (tokenIssuedAt < vendorUser.tokenInvalidatedAt) {
          console.log(`Token invalidated for vendor user ${payload.id}. Token issued: ${tokenIssuedAt}, Invalidated: ${vendorUser.tokenInvalidatedAt}`);
          res.status(401);
          return next(new Error('Token has been invalidated. Please log in again.'));
        }
      }
    }
    
    req.user = payload;
    req.token = token;
    return next();
  } catch (err) {
    res.status(401);
    return next(new Error('Invalid or expired token'));
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403);
    return next(new Error('Admin access required'));
  }
  return next();
};

const requireRole = (roles) => (req, res, next) => {
  console.log('requireRole - checking roles:', roles);
  console.log('requireRole - user:', req.user);
  console.log('requireRole - user role:', req.user?.role);
  
  if (!req.user || !roles.includes(req.user.role)) {
    console.log('requireRole - access denied');
    res.status(403);
    return next(new Error('Insufficient permissions'));
  }
  console.log('requireRole - access granted');
  return next();
};

const getUserPermissions = async (req) => {
  // Admin users have full access
  if (req.user?.role === 'admin') {
    return ['*'];
  }

  // For vendor users, always compute fresh permissions from the database
  if (req.user?.role === 'vendor') {
    const vendorUser = await VendorUser.findById(req.user.id).populate('roleRef').lean();
    if (!vendorUser) return [];

    const rolePermissions = Array.isArray(vendorUser?.roleRef?.permissions)
      ? vendorUser.roleRef.permissions
      : [];

    // Merge and de-duplicate
    return Array.from(new Set([...
      rolePermissions
    ]));
  }

  return [];
};

const requirePermission = (permission) => async (req, res, next) => {
  try {
    const perms = await getUserPermissions(req);
    if (perms.includes('*') || perms.includes(permission)) return next();
    res.status(403);
    return next(new Error('Permission denied'));
  } catch (e) {
    return next(e);
  }
};

const requireAnyPermission = (permissions) => async (req, res, next) => {
  try {
    console.log('requireAnyPermission - checking permissions:', permissions);
    console.log('requireAnyPermission - user:', req.user);
    
    const perms = await getUserPermissions(req);
    console.log('requireAnyPermission - user permissions:', perms);
    
    if (perms.includes('*')) {
      console.log('requireAnyPermission - admin access granted');
      return next();
    }
    
    for (const p of permissions) {
      if (perms.includes(p)) {
        console.log('requireAnyPermission - permission granted:', p);
        return next();
      }
    }
    
    console.log('requireAnyPermission - permission denied');
    res.status(403);
    return next(new Error('Permission denied'));
  } catch (e) {
    console.error('requireAnyPermission - error:', e);
    return next(e);
  }
};

module.exports = { authenticate, requireAdmin, requireRole, requirePermission, requireAnyPermission, getUserPermissions, getJwtSecret };
