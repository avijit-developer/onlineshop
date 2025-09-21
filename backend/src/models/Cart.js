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
      default: undefined
    },
    price: {
      type: Number,
      required: function() {
        const vi = this.variantInfo;
        if (!vi) return false;
        const attrs = vi.attributes;
        if (!attrs) return false;
        let obj = attrs;
        if (typeof attrs?.toJSON === 'function') obj = attrs.toJSON();
        else if (typeof attrs?.get === 'function') {
          try { obj = Object.fromEntries(attrs); } catch (_) { obj = {}; }
        }
        return obj && Object.keys(obj).length > 0;
      }
    },
    specialPrice: {
      type: Number
    },
    // Vendor variant prices (for vendor settlements/views)
    vendorPrice: {
      type: Number
    },
    vendorSpecialPrice: {
      type: Number
    },
    stock: {
      type: Number,
      required: function() {
        const vi = this.variantInfo;
        if (!vi) return false;
        const attrs = vi.attributes;
        if (!attrs) return false;
        let obj = attrs;
        if (typeof attrs?.toJSON === 'function') obj = attrs.toJSON();
        else if (typeof attrs?.get === 'function') {
          try { obj = Object.fromEntries(attrs); } catch (_) { obj = {}; }
        }
        return obj && Object.keys(obj).length > 0;
      }
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
  couponCode: { type: String, default: null },
  couponDiscount: { type: Number, default: 0 },
  freeShippingApplied: { type: Boolean, default: false },
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
  // Resolve productId from string/object
  const productId = (typeof product === 'string' || typeof product === 'number')
    ? String(product)
    : String(product?.id || product?._id || '');
  if (!productId) {
    throw new Error('Invalid product id');
  }

  // Create unique cart ID based on product and variant
  let cartId = productId;
  if (selectedAttributes && Object.keys(selectedAttributes).length > 0) {
    const variantKey = Object.entries(selectedAttributes)
      .map(([key, value]) => `${key}:${value}`)
      .sort()
      .join('|');
    cartId = `${productId}-${variantKey}`;
  }

  // Check if item already exists
  const existingItemIndex = this.items.findIndex(item => item.cartId === cartId);

  if (existingItemIndex !== -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity = quantity;
    const hasSelected = selectedAttributes && Object.keys(selectedAttributes).length > 0;
    if (hasSelected) {
      this.items[existingItemIndex].variantInfo = {
        attributes: selectedAttributes,
        price: product.selectedVariant?.price || product.regularPrice,
        specialPrice: product.selectedVariant?.specialPrice || product.specialPrice,
        vendorPrice: product.selectedVariant?.vendorPrice || product.vendorRegularPrice,
        vendorSpecialPrice: product.selectedVariant?.vendorSpecialPrice || product.vendorSpecialPrice,
        stock: product.selectedVariant?.stock || product.stock,
        sku: product.selectedVariant?.sku || product.sku,
        images: product.selectedVariant?.images || []
      };
    } else {
      // Explicitly remove variantInfo when no attributes are selected
      if (this.items[existingItemIndex].variantInfo !== undefined) {
        delete this.items[existingItemIndex].variantInfo;
        this.markModified('items');
      }
    }
    this.items[existingItemIndex].images = (product && (product.images || [product.image])) || [];
  } else {
    // Add new item
    const newItem = {
      product: productId,
      quantity,
      selectedAttributes: selectedAttributes || {},
      cartId,
      images: (product && (product.images || [product.image])) || []
    };
    if (selectedAttributes && Object.keys(selectedAttributes).length > 0) {
      newItem.variantInfo = {
        attributes: selectedAttributes,
        price: product.selectedVariant?.price || product.regularPrice,
        specialPrice: product.selectedVariant?.specialPrice || product.specialPrice,
        vendorPrice: product.selectedVariant?.vendorPrice || product.vendorRegularPrice,
        vendorSpecialPrice: product.selectedVariant?.vendorSpecialPrice || product.vendorSpecialPrice,
        stock: product.selectedVariant?.stock || product.stock,
        sku: product.selectedVariant?.sku || product.sku,
        images: product.selectedVariant?.images || []
      };
    }
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