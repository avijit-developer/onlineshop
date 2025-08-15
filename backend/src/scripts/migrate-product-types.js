const mongoose = require('mongoose');
const Product = require('../models/Product');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eshop', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function to update product types
const migrateProductTypes = async () => {
  try {
    console.log('Starting product type migration...');
    
    // Use the new static method from the Product model
    const result = await Product.fixProductTypes();
    
    console.log('\nMigration completed successfully!');
    console.log(`Total products processed: ${result.total}`);
    console.log(`Products fixed: ${result.fixed}`);
    
    // Get final counts
    const simpleCount = await Product.countDocuments({ productType: 'simple' });
    const configurableCount = await Product.countDocuments({ productType: 'configurable' });
    
    console.log(`Final counts - Simple: ${simpleCount}, Configurable: ${configurableCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  }
};

// Run migration if this script is executed directly
if (require.main === module) {
  connectDB().then(() => {
    migrateProductTypes();
  });
}

module.exports = { migrateProductTypes };