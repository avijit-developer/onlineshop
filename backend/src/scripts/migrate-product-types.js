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
    
    // Find all products
    const products = await Product.find({});
    console.log(`Found ${products.length} products to migrate`);
    
    let updatedCount = 0;
    let simpleCount = 0;
    let configurableCount = 0;
    
    for (const product of products) {
      const hasVariants = product.variants && product.variants.length > 0;
      const newProductType = hasVariants ? 'configurable' : 'simple';
      
      // Only update if the productType is different or doesn't exist
      if (product.productType !== newProductType) {
        await Product.findByIdAndUpdate(product._id, { productType: newProductType });
        updatedCount++;
        
        if (newProductType === 'simple') {
          simpleCount++;
        } else {
          configurableCount++;
        }
        
        console.log(`Updated product "${product.name}" (${product._id}) to type: ${newProductType}`);
      }
    }
    
    console.log('\nMigration completed successfully!');
    console.log(`Total products processed: ${products.length}`);
    console.log(`Products updated: ${updatedCount}`);
    console.log(`Simple products: ${simpleCount}`);
    console.log(`Configurable products: ${configurableCount}`);
    
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