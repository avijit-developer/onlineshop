const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const { execSync } = require('child_process');

const backupPath = 'C:\\backup\\eshopDB';

(async () => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Check if backup exists
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup not found at: ${backupPath}`);
      process.exit(1);
    }

    console.log(`📦 Found backup at: ${backupPath}`);
    
    // Find mongorestore
    const possiblePaths = [
      'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongorestore.exe',
      'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongorestore.exe',
      'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongorestore.exe',
      'mongorestore' // If in PATH
    ];

    let mongorestorePath = null;
    for (const p of possiblePaths) {
      try {
        if (p === 'mongorestore') {
          execSync('mongorestore --version', { stdio: 'ignore' });
          mongorestorePath = 'mongorestore';
          break;
        } else if (fs.existsSync(p)) {
          mongorestorePath = p;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!mongorestorePath) {
      console.error('❌ mongorestore not found. Please install MongoDB Database Tools.');
      console.log('\nAlternative: Using Node.js to restore...');
      
      // Alternative: Use Node.js to restore
      await restoreWithNode();
      process.exit(0);
    }

    console.log(`🔧 Using mongorestore at: ${mongorestorePath}`);
    console.log('🔄 Restoring database...\n');

    // Extract database name from MONGODB_URI
    const uri = process.env.MONGODB_URI;
    const dbMatch = uri.match(/\/([^/?]+)(\?|$)/);
    const dbName = dbMatch ? dbMatch[1] : 'eshopDB';

    // Run mongorestore
    const command = `"${mongorestorePath}" --db ${dbName} "${backupPath}" --drop`;
    console.log(`Running: ${command}\n`);
    
    execSync(command, { 
      stdio: 'inherit',
      shell: true
    });

    console.log('\n✅ Database restored successfully!');
    
    // Verify
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`\n📊 Collections restored: ${collections.length}`);
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   ${col.name}: ${count} documents`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Restore failed:', err.message);
    console.error(err);
    process.exit(1);
  }
})();

async function restoreWithNode() {
  console.log('📦 Restoring using Node.js...');
  const db = mongoose.connection.db;
  
  // List all collection directories in backup
  const collections = fs.readdirSync(backupPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${collections.length} collections to restore\n`);

  for (const collectionName of collections) {
    const collectionPath = path.join(backupPath, collectionName);
    const metadataFile = path.join(collectionPath, 'metadata.json');
    const dataFiles = fs.readdirSync(collectionPath)
      .filter(f => f.endsWith('.bson'))
      .map(f => path.join(collectionPath, f));

    if (dataFiles.length === 0) continue;

    console.log(`Restoring ${collectionName}...`);
    
    try {
      // Drop existing collection
      await db.collection(collectionName).drop().catch(() => {});
      
      // Read and insert documents from BSON files
      // Note: This is a simplified approach. For production, use mongorestore.
      console.log(`   ⚠️  Manual BSON parsing not implemented. Please use mongorestore tool.`);
    } catch (err) {
      console.error(`   ❌ Error restoring ${collectionName}:`, err.message);
    }
  }
}

