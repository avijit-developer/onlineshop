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

const requirePermission = (permission) => async (req, res, next) => {
  // Admin bypass
  if (req.user && req.user.role === 'admin') return next();
  if (!req.user || req.user.role !== 'vendor') {
    res.status(403);
    return next(new Error('Insufficient permissions'));
  }
  try {
    let permissions = Array.isArray(req.user.permissions) ? req.user.permissions : null;
    if (!permissions) {
      const vu = await VendorUser.findById(req.user.id).select({ permissions: 1 }).lean();
      permissions = vu?.permissions || [];
    }
    if (!permissions.includes(permission)) {
      res.status(403);
      return next(new Error('Permission denied'));
    }
    return next();
  } catch (e) {
    return next(e);
  }
};

module.exports = { authenticate, requireAdmin, requireRole, requirePermission };