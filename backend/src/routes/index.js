const express = require('express');
const users = require('./users.routes');

const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'API v1' }));
router.use('/users', users);

module.exports = router;