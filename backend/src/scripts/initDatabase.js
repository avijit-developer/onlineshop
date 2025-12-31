const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Settings = require('../models/Settings');
const HomePageSection = require('../models/HomePageSection');
const Role = require('../models/Role');

const defaultSections = [
  {
    name: 'most-popular',
    title: 'Most Popular',
    subtitle: 'Trending products everyone loves',
    isActive: true,
    order: 1,
    type: 'auto-popular',
    settings: {
      maxProducts: 10,
      showPrice: true,
      showRating: true,
      layout: 'horizontal',
      showTags: true
    },
    autoSettings: {
      minSales: 5,
      minRating: 0,
      daysBack: 30
    }
  },
  {
    name: 'best-seller',
    title: 'Best Sellers',
    subtitle: 'Top performing products',
    isActive: true,
    order: 2,
    type: 'auto-popular',
    settings: {
      maxProducts: 8,
      showPrice: true,
      showRating: true,
      layout: 'horizontal',
      showTags: true
    },
    autoSettings: {
      minSales: 10,
      minRating: 0,
      daysBack: 60
    }
  },
  {
    name: 'just-for-you',
    title: 'Just For You',
    subtitle: 'Personalized recommendations',
    isActive: true,
    order: 3,
    type: 'auto-recent',
    settings: {
      maxProducts: 12,
      showPrice: true,
      showRating: true,
      layout: 'grid',
      showTags: true
    },
    autoSettings: {
      minRating: 0,
      daysBack: 7
    }
  },
  {
    name: 'new-arrivals',
    title: 'New Arrivals',
    subtitle: 'Fresh products just added',
    isActive: true,
    order: 4,
    type: 'auto-recent',
    settings: {
      maxProducts: 6,
      showPrice: true,
      showRating: false,
      layout: 'horizontal',
      showTags: true
    },
    autoSettings: {
      minRating: 0,
      daysBack: 14
    }
  }
];

(async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database\n');

    // 1. Create Admin Account
    console.log('👤 Creating admin account...');
    const adminName = process.env.ADMIN_NAME || 'Admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    let admin = await Admin.findOne({ email: adminEmail });
    if (admin) {
      admin.name = adminName;
      admin.passwordHash = passwordHash;
      admin.isActive = true;
      await admin.save();
      console.log(`✅ Admin updated: ${adminEmail}`);
    } else {
      admin = await Admin.create({ name: adminName, email: adminEmail, passwordHash, role: 'admin' });
      console.log(`✅ Admin created: ${adminEmail}`);
    }

    // Create corresponding User
    let user = await User.findOne({ email: adminEmail });
    if (user) {
      if (user.name !== adminName) {
        user.name = adminName;
        await user.save();
      }
      console.log(`✅ User linked: ${adminEmail}`);
    } else {
      user = await User.create({ name: adminName, email: adminEmail });
      console.log(`✅ User created: ${adminEmail}`);
    }

    // 2. Create Default Roles
    console.log('\n🔐 Creating default roles...');
    const roles = [
      { name: 'admin', description: 'Administrator', permissions: ['all'] },
      { name: 'vendor', description: 'Vendor', permissions: ['manage_products', 'manage_orders'] },
      { name: 'customer', description: 'Customer', permissions: ['view_products', 'place_orders'] },
      { name: 'driver', description: 'Driver', permissions: ['view_orders', 'update_delivery'] }
    ];

    for (const roleData of roles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (!existingRole) {
        await Role.create(roleData);
        console.log(`✅ Role created: ${roleData.name}`);
      } else {
        console.log(`ℹ️  Role exists: ${roleData.name}`);
      }
    }

    // 3. Create Default Settings
    console.log('\n⚙️  Creating default settings...');
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        siteName: 'E-Shop',
        siteDescription: 'Your online shopping destination',
        currency: 'INR',
        currencySymbol: '₹',
        taxRate: 0,
        shippingCost: 0,
        freeShippingThreshold: 0,
        deliveryArea: {
          latitude: null,
          longitude: null,
          radius: null
        },
        paymentMethods: ['cod'],
        orderStatuses: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
      });
      console.log('✅ Default settings created');
    } else {
      console.log('ℹ️  Settings already exist');
    }

    // 4. Create Homepage Sections
    console.log('\n🏠 Creating homepage sections...');
    for (const section of defaultSections) {
      const existing = await HomePageSection.findOne({ name: section.name });
      if (!existing) {
        await HomePageSection.create(section);
        console.log(`✅ Section created: ${section.title}`);
      } else {
        console.log(`ℹ️  Section exists: ${section.title}`);
      }
    }

    console.log('\n✨ Database initialization completed!');
    console.log(`\n📧 Admin Login Credentials:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`\n⚠️  Please change the default password after first login!`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    console.error(err);
    process.exit(1);
  }
})();

