const jwt = require('jsonwebtoken');
const VendorUser = require('../models/VendorUser');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  if (process.env.NODE_ENV !== 'production' && secret === 'dev-secret') {
    console.warn('Warning: Using default JWT secret. Set JWT_SECRET in environment for production.');
  }
  return secret;
}

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401);
    return next(new Error('Authentication token missing'));
  }
  try {
    const payload = jwt.verify(token, getJwtSecret());
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
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    return next(new Error('Insufficient permissions'));
  }
  return next();
};

const getUserPermissions = async (req) => {
  console.log('getUserPermissions - user role:', req.user?.role);
  console.log('getUserPermissions - user permissions from token:', req.user?.permissions);
  
  if (req.user?.role === 'admin') {
    console.log('getUserPermissions - admin user, returning all permissions');
    return ['*'];
  }
  
  if (req.user?.role === 'vendor') {
    let perms = Array.isArray(req.user.permissions) ? req.user.permissions : null;
    console.log('getUserPermissions - vendor user, permissions from token:', perms);
    
    if (!perms) {
      console.log('getUserPermissions - fetching permissions from database');
      const vu = await VendorUser.findById(req.user.id).select({ permissions: 1 }).lean();
      perms = vu?.permissions || [];
      console.log('getUserPermissions - permissions from database:', perms);
    }
    return perms;
  }
  
  console.log('getUserPermissions - no role found, returning empty array');
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

module.exports = { authenticate, requireAdmin, requireRole, requirePermission, requireAnyPermission };