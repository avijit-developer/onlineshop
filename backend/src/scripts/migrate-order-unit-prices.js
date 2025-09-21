require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecommerce';
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
  console.log('[migrate-order-unit-prices] Connected');

  const cursor = Order.find({}).cursor();
  let processed = 0, updated = 0;
  for (let order = await cursor.next(); order != null; order = await cursor.next()) {
    let changed = false;
    for (const it of (order.items || [])) {
      // Skip if already populated
      const hasAdmin = it.adminUnitPrice != null || it.adminUnitSpecialPrice != null;
      const hasVendor = it.vendorUnitPrice != null || it.vendorUnitSpecialPrice != null;
      if (hasAdmin && hasVendor) continue;

      // Try to backfill from product snapshot if order.item has embedded product fields
      // Otherwise look up product to infer vendor/admin prices
      let prod = null;
      try {
        if (it.product) {
          prod = await Product.findById(it.product).select('regularPrice specialPrice vendorRegularPrice vendorSpecialPrice variants').lean();
        }
      } catch (_) {}

      // Determine admin/vender prices with preference to variant if SKU matches
      let adminPrice = null, adminSpecial = null, vendorPrice = null, vendorSpecial = null;
      if (prod) {
        // Match variant by SKU if possible
        let variant = null;
        const sku = it.sku || null;
        if (sku && Array.isArray(prod.variants)) {
          variant = prod.variants.find(v => String(v.sku || '') === String(sku));
        }
        if (variant) {
          adminPrice = (variant.price != null ? Number(variant.price) : null);
          adminSpecial = (variant.specialPrice != null ? Number(variant.specialPrice) : null);
          vendorPrice = (variant.vendorPrice != null ? Number(variant.vendorPrice) : null);
          vendorSpecial = (variant.vendorSpecialPrice != null ? Number(variant.vendorSpecialPrice) : null);
        }
        if (adminPrice == null && (prod.regularPrice != null)) adminPrice = Number(prod.regularPrice);
        if (adminSpecial == null && (prod.specialPrice != null)) adminSpecial = Number(prod.specialPrice);
        if (vendorPrice == null && (prod.vendorRegularPrice != null)) vendorPrice = Number(prod.vendorRegularPrice);
        if (vendorSpecial == null && (prod.vendorSpecialPrice != null)) vendorSpecial = Number(prod.vendorSpecialPrice);
      }

      // Fallbacks from existing order item fields
      if (adminPrice == null && it.price != null) adminPrice = Number(it.price);
      if (adminSpecial == null && it.specialPrice != null) adminSpecial = Number(it.specialPrice);

      if (!hasAdmin) {
        it.adminUnitPrice = adminPrice;
        it.adminUnitSpecialPrice = adminSpecial;
        changed = true;
      }
      if (!hasVendor) {
        it.vendorUnitPrice = vendorPrice;
        it.vendorUnitSpecialPrice = vendorSpecial;
        changed = true;
      }
    }
    processed++;
    if (changed) { await order.save(); updated++; }
    if (processed % 100 === 0) console.log(`[migrate] processed=${processed}, updated=${updated}`);
  }

  console.log(`[migrate] Done. processed=${processed}, updated=${updated}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[migrate-order-unit-prices] Error:', err);
  process.exit(1);
});

