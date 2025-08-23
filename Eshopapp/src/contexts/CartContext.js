
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status and load cart
  useEffect(() => {
    checkAuthAndLoadCart();
  }, []);

  const checkAuthAndLoadCart = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is authenticated
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        setIsAuthenticated(true);
        await loadCart();
      } else {
        setIsAuthenticated(false);
        setCartItems([]);
        console.log('User not authenticated, cart is empty');
      }
    } catch (error) {
      console.log('Error checking authentication:', error);
      setIsAuthenticated(false);
      setCartItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCart = async () => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot load cart');
        return;
      }

      const response = await api.getUserCart();
      if (response && response.success && response.data) {
        // Transform API cart data to match frontend format
        const transformedItems = response.data.items.map(item => ({
          id: item.product._id || item.product.id,
          name: item.product.name,
          cartId: item.cartId,
          quantity: item.quantity,
          selectedAttributes: item.selectedAttributes ? Object.fromEntries(item.selectedAttributes) : {},
          variantInfo: item.variantInfo ? {
            attributes: item.variantInfo.attributes ? Object.fromEntries(item.variantInfo.attributes) : {},
            price: item.variantInfo.price,
            specialPrice: item.variantInfo.specialPrice,
            stock: item.variantInfo.stock,
            sku: item.variantInfo.sku,
            images: item.variantInfo.images || []
          } : null,
          images: item.images || [],
          regularPrice: item.product.regularPrice,
          specialPrice: item.product.specialPrice,
          stock: item.product.stock,
          sku: item.product.sku
        }));
        setCartItems(transformedItems);
        console.log('Loaded cart from database:', transformedItems.length, 'items');
      } else {
        setCartItems([]);
        console.log('No cart data found in database');
      }
    } catch (error) {
      console.log('Error loading cart from database:', error);
      setCartItems([]);
    }
  };

  const addToCart = async (product, quantity = 1, selectedAttributes = null) => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot add to cart');
        return;
      }

      console.log('Adding to cart via database:', product.name, quantity, selectedAttributes);
      
      // Call API to add item to database
      const response = await api.addToUserCart(product, quantity, selectedAttributes);
      
      if (response && response.success) {
        // Reload cart from database to get updated data
        await loadCart();
      } else {
        console.log('Failed to add item to cart in database');
      }
      
    } catch (error) {
      console.log('Error adding to cart:', error);
    }
  };

  const removeFromCart = async (cartId) => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot remove from cart');
        return;
      }

      console.log('Removing item from cart via database:', cartId);
      
      // Call API to remove item from database
      const response = await api.removeFromUserCart(cartId);
      
      if (response && response.success) {
        // Reload cart from database to get updated data
        await loadCart();
      } else {
        console.log('Failed to remove item from cart in database');
      }
      
    } catch (error) {
      console.log('Error removing from cart:', error);
    }
  };

  const updateQuantity = async (cartId, quantity) => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot update cart');
        return;
      }

      if (quantity <= 0) {
        await removeFromCart(cartId);
        return;
      }

      console.log('Updating quantity via database:', cartId, quantity);
      
      // Call API to update quantity in database
      const response = await api.updateUserCartItem(cartId, quantity);
      
      if (response && response.success) {
        // Reload cart from database to get updated data
        await loadCart();
      } else {
        console.log('Failed to update quantity in database');
      }
      
    } catch (error) {
      console.log('Error updating quantity:', error);
    }
  };

  const clearCart = async () => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot clear cart');
        return;
      }

      console.log('Clearing cart via database');
      
      // Call API to clear cart in database
      const response = await api.clearUserCart();
      
      if (response && response.success) {
        // Reload cart from database to get updated data
        await loadCart();
      } else {
        console.log('Failed to clear cart in database');
      }
      
    } catch (error) {
      console.log('Error clearing cart:', error);
    }
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

  const getItemImage = (item) => {
    // Try multiple image sources in order of preference
    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
      return item.images[0];
    }
    if (item.image && typeof item.image === 'string') {
      return item.image;
    }
    if (item.selectedVariant?.images && Array.isArray(item.selectedVariant.images) && item.selectedVariant.images.length > 0) {
      return item.selectedVariant.images[0];
    }
    if (item.variantInfo?.images && Array.isArray(item.variantInfo.images) && item.variantInfo.images.length > 0) {
      return item.variantInfo.images[0];
    }
    if (item.currentImages && Array.isArray(item.currentImages) && item.currentImages.length > 0) {
      return item.currentImages[0];
    }
    
    return null;
  };

  const refreshCart = () => {
    checkAuthAndLoadCart();
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    cartItems,
    isLoading,
    isAuthenticated,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    getItemPrice,
    getItemTotal,
    getItemImage,
    refreshCart,
  }), [cartItems, isLoading, isAuthenticated]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};