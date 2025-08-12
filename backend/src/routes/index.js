const express = require('express');
const users = require('./users.routes');
const auth = require('./auth.routes');
const admins = require('./admins.routes');
const categories = require('./categories.routes');
const uploads = require('./uploads.routes');

const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'API v1' }));
router.use('/auth', auth);
router.use('/users', users);
router.use('/admins', admins);
router.use('/categories', categories);
router.use('/uploads', uploads);

module.exports = router;