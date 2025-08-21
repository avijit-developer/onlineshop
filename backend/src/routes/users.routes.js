const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const router = express.Router();

const isValidEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post('/', async (req, res) => {
  const { name, email } = req.body || {};

  if (!name || !email) {
    res.status(400);
    throw new Error('Both name and email are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const exists = await User.findOne({ email: email.toLowerCase() }).lean();
  if (exists) {
    res.status(409);
    throw new Error('Email already in use');
  }

  const passwordHash = await bcrypt.hash('Temp#1234', 10);
  const user = await User.create({ name, email, passwordHash, role: 'customer' });
  res.status(201).json({ success: true, data: user });
});

router.get('/', async (req, res) => {
  const users = await User.find().lean();
  res.json({ success: true, data: users });
});

module.exports = router;