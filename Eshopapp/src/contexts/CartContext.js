import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (product, quantity = 1, selectedAttributes = null) => {
    console.log('Adding to cart:', product.name, quantity, selectedAttributes);
    
    setCartItems(prevItems => {
      // Create unique cart ID based on product and variant
      let cartId = product.id;
      if (selectedAttributes && Object.keys(selectedAttributes).length > 0) {
        const variantKey = Object.entries(selectedAttributes)
          .map(([key, value]) => `${key}:${value}`)
          .sort()
          .join('|');
        cartId = `${product.id}-${variantKey}`;
      }

      const existingItem = prevItems.find(item => item.cartId === cartId);

      if (existingItem) {
        // Update existing item quantity - replace with new quantity instead of adding
        const updated = prevItems.map(item =>
          item.cartId === cartId
            ? { ...item, quantity: quantity } // Replace quantity, don't add
            : item
        );
        console.log('Updated cart items:', updated.length);
        return updated;
      }

      // Create new cart item
      const newItem = { 
        ...product, 
        quantity, 
        selectedAttributes,
        cartId,
        // Store variant-specific information
        variantInfo: selectedAttributes ? {
          attributes: selectedAttributes,
          price: product.selectedVariant?.price || product.regularPrice,
          specialPrice: product.selectedVariant?.specialPrice || product.specialPrice,
          stock: product.selectedVariant?.stock || product.stock,
          sku: product.selectedVariant?.sku || product.sku
        } : null
      };
      
      const newItems = [...prevItems, newItem];
      console.log('New cart items:', newItems.length);
      return newItems;
    });
  };

  const removeFromCart = (cartId) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartId !== cartId));
  };

  const updateQuantity = (cartId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(cartId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.cartId === cartId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const parsePrice = (p) => {
    if (typeof p === 'number') return p;
    if (typeof p === 'string') {
      const cleaned = p.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const getItemPrice = (item) => {
    // Use variant price if available, otherwise fall back to regular price
    if (item.variantInfo?.price) {
      return item.variantInfo.price;
    }
    if (item.variantInfo?.specialPrice && item.variantInfo.specialPrice < item.variantInfo.price) {
      return item.variantInfo.specialPrice;
    }
    if (item.regularPrice) {
      return item.regularPrice;
    }
    if (item.specialPrice && item.specialPrice < item.regularPrice) {
      return item.specialPrice;
    }
    return parsePrice(item.price);
  };

  const getItemTotal = (item) => {
    const price = getItemPrice(item);
    return price * item.quantity;
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      const price = getItemPrice(item);
      return total + (price * item.quantity);
    }, 0);
  };

  const getCartItemsCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    getItemPrice,
    getItemTotal,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};