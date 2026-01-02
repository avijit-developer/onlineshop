const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database\n');

    // Find all admin users
    const admins = await Admin.find({ role: 'admin' }).select('name email phone isActive createdAt').lean();

    if (admins.length === 0) {
      console.log('❌ No admin users found in database');
    } else {
      console.log(`📋 Found ${admins.length} admin user(s):\n`);
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Admin Details:`);
        console.log(`   Name: ${admin.name || 'N/A'}`);
        console.log(`   Email: ${admin.email || 'N/A'}`);
        console.log(`   Phone: ${admin.phone || 'NOT SET'}`);
        console.log(`   Active: ${admin.isActive ? 'Yes' : 'No'}`);
        console.log(`   Created: ${admin.createdAt ? new Date(admin.createdAt).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();

