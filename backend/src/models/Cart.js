const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  selectedAttributes: {
    type: Map,
    of: String,
    default: {}
  },
  cartId: {
    type: String,
    required: true
  },
  variantInfo: {
    attributes: {
      type: Map,
      of: String,
      default: {}
    },
    price: {
      type: Number,
      required: true
    },
    specialPrice: {
      type: Number
    },
    stock: {
      type: Number,
      required: true
    },
    sku: {
      type: String
    },
    images: [{
      type: String
    }]
  },
  images: [{
    type: String
  }],
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
cartSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Add methods to the cart schema
cartSchema.methods.addItem = function(product, quantity, selectedAttributes) {
  // Create unique cart ID based on product and variant
  let cartId = product.id || product._id;
  if (selectedAttributes && Object.keys(selectedAttributes).length > 0) {
    const variantKey = Object.entries(selectedAttributes)
      .map(([key, value]) => `${key}:${value}`)
      .sort()
      .join('|');
    cartId = `${product.id || product._id}-${variantKey}`;
  }

  // Check if item already exists
  const existingItemIndex = this.items.findIndex(item => item.cartId === cartId);

  if (existingItemIndex !== -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity = quantity;
    this.items[existingItemIndex].variantInfo = selectedAttributes ? {
      attributes: selectedAttributes,
      price: product.selectedVariant?.price || product.regularPrice,
      specialPrice: product.selectedVariant?.specialPrice || product.specialPrice,
      stock: product.selectedVariant?.stock || product.stock,
      sku: product.selectedVariant?.sku || product.sku,
      images: product.selectedVariant?.images || []
    } : null;
    this.items[existingItemIndex].images = product.images || [product.image] || [];
  } else {
    // Add new item
    const newItem = {
      product: product.id || product._id,
      quantity,
      selectedAttributes: selectedAttributes || {},
      cartId,
      variantInfo: selectedAttributes ? {
        attributes: selectedAttributes,
        price: product.selectedVariant?.price || product.regularPrice,
        specialPrice: product.selectedVariant?.specialPrice || product.specialPrice,
        stock: product.selectedVariant?.stock || product.stock,
        sku: product.selectedVariant?.sku || product.sku,
        images: product.selectedVariant?.images || []
      } : null,
      images: product.images || [product.image] || []
    };
    this.items.push(newItem);
  }

  return this;
};

cartSchema.methods.removeItem = function(cartId) {
  this.items = this.items.filter(item => item.cartId !== cartId);
  return this;
};

cartSchema.methods.updateQuantity = function(cartId, quantity) {
  const item = this.items.find(item => item.cartId === cartId);
  if (item) {
    if (quantity <= 0) {
      this.removeItem(cartId);
    } else {
      item.quantity = quantity;
    }
  }
  return this;
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  return this;
};

cartSchema.methods.getTotal = function() {
  return this.items.reduce((total, item) => {
    const price = item.variantInfo?.price || 0;
    return total + (price * item.quantity);
  }, 0);
};

cartSchema.methods.getItemCount = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

module.exports = mongoose.model('Cart', cartSchema);