const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');

async function checkOrderCoordinates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onlineshop';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Order number to check
    const orderNumber = process.argv[2] || 'ORD-1766985083547';
    console.log(`\n🔍 Checking order: ${orderNumber}\n`);

    // Find order
    const order = await Order.findOne({ orderNumber }).lean();
    
    if (!order) {
      console.log('❌ Order not found!');
      process.exit(1);
    }

    console.log('✅ Order found!');
    console.log('\n📦 Order Details:');
    console.log('   Order Number:', order.orderNumber);
    console.log('   Status:', order.status);
    console.log('   Created At:', order.createdAt);
    console.log('   Shipping Address:', order.shippingAddress);
    console.log('\n📍 Coordinates:');
    console.log('   deliveryLatitude:', order.deliveryLatitude, '(Type:', typeof order.deliveryLatitude, ')');
    console.log('   deliveryLongitude:', order.deliveryLongitude, '(Type:', typeof order.deliveryLongitude, ')');
    
    if (order.deliveryLatitude != null && order.deliveryLongitude != null) {
      console.log('\n✅ Coordinates are saved!');
      console.log('   Google Maps Link: https://www.google.com/maps?q=' + order.deliveryLatitude + ',' + order.deliveryLongitude);
    } else {
      console.log('\n❌ Coordinates are NOT saved (null or undefined)');
    }

    // Check raw document
    console.log('\n📄 Raw Order Document (relevant fields):');
    console.log(JSON.stringify({
      orderNumber: order.orderNumber,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      shippingAddress: order.shippingAddress
    }, null, 2));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOrderCoordinates();

