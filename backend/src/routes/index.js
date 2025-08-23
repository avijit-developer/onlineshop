const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const productsRoutes = require('./products.routes');
const categoriesRoutes = require('./categories.routes');
const brandsRoutes = require('./brands.routes');
const vendorsRoutes = require('./vendors.routes');
const vendorUsersRoutes = require('./vendorUsers.routes');
const adminsRoutes = require('./admins.routes');
const bannersRoutes = require('./banners.routes');
const rolesRoutes = require('./roles.routes');
const uploadsRoutes = require('./uploads.routes');
const homepageRoutes = require('./homepage.routes');
const cartRoutes = require('./cart.routes');
const ordersRoutes = require('./orders.routes');
const adminDashboardRoutes = require('./dashboard.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/products', productsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/brands', brandsRoutes);
router.use('/vendors', vendorsRoutes);
router.use('/vendor-users', vendorUsersRoutes);
router.use('/admins', adminsRoutes);
router.use('/banners', bannersRoutes);
router.use('/roles', rolesRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/homepage', homepageRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', ordersRoutes);
router.use('/admin/dashboard', adminDashboardRoutes);

module.exports = router;