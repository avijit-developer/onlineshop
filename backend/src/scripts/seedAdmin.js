require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  try {
    await connectDB();

    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase() : undefined;
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error('ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await Admin.findOne({ email });
    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.isActive = true;
      await existing.save();
      console.log('Admin updated:', { id: existing._id.toString(), email: existing.email });
    } else {
      const admin = await Admin.create({ name, email, passwordHash, role: 'admin' });
      console.log('Admin created:', { id: admin._id.toString(), email: admin.email });
    }

    process.exit(0);
  } catch (err) {
    console.error('Admin seed failed:', err.message);
    process.exit(1);
  }
})();