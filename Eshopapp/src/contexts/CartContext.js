
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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

  // Load cart data from API when app starts
  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setIsLoading(true);
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
        console.log('Loaded cart from API:', transformedItems.length, 'items');
      }
    } catch (error) {
      console.log('Error loading cart from API:', error);
      // If API fails, try to load from local storage as fallback
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage');
        const storedCart = await AsyncStorage.getItem('cartData');
        if (storedCart) {
          const parsedCart = JSON.parse(storedCart);
          setCartItems(parsedCart);
          console.log('Loaded cart from local storage fallback:', parsedCart.length, 'items');
        }
      } catch (localError) {
        console.log('Error loading from local storage:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = async (product, quantity = 1, selectedAttributes = null) => {
    try {
      console.log('Adding to cart via API:', product.name, quantity, selectedAttributes);
      
      // First update local state for immediate UI response
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
          // Update existing item quantity
          return prevItems.map(item =>
            item.cartId === cartId
              ? { 
                  ...item, 
                  quantity: quantity,
                  images: item.images || item.image ? [item.image] : [],
                  variantInfo: item.variantInfo ? {
                    ...item.variantInfo,
                    images: item.variantInfo.images || []
                  } : null
                }
              : item
          );
        }

        // Create new cart item
        const newItem = { 
          ...product, 
          quantity, 
          selectedAttributes,
          cartId,
          images: (() => {
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
              return product.images;
            }
            if (product.image && typeof product.image === 'string') {
              return [product.image];
            }
            if (product.selectedVariant?.images && Array.isArray(product.selectedVariant.images) && product.selectedVariant.images.length > 0) {
              return product.selectedVariant.images;
            }
            if (product.currentImages && Array.isArray(product.currentImages) && product.currentImages.length > 0) {
              return product.currentImages;
            }
            return [];
          })(),
          variantInfo: selectedAttributes ? {
            attributes: selectedAttributes,
            price: product.selectedVariant?.price || product.regularPrice,
            specialPrice: product.selectedVariant?.specialPrice || product.specialPrice,
            stock: product.selectedVariant?.stock || product.stock,
            sku: product.selectedVariant?.sku || product.sku,
            images: product.selectedVariant?.images || []
          } : null
        };
        
        return [...prevItems, newItem];
      });

      // Then sync with API
      await api.addToUserCart(product, quantity, selectedAttributes);
      
      // Reload cart from API to ensure consistency
      await loadCart();
      
    } catch (error) {
      console.log('Error adding to cart via API:', error);
      // If API fails, save to local storage as fallback
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('cartData', JSON.stringify(cartItems));
      } catch (localError) {
        console.log('Error saving to local storage:', localError);
      }
    }
  };

  const removeFromCart = async (cartId) => {
    try {
      // First update local state for immediate UI response
      setCartItems(prevItems => prevItems.filter(item => item.cartId !== cartId));
      
      // Then sync with API
      await api.removeFromUserCart(cartId);
      
      // Reload cart from API to ensure consistency
      await loadCart();
      
    } catch (error) {
      console.log('Error removing from cart via API:', error);
      // If API fails, reload from local storage
      await loadCart();
    }
  };

  const updateQuantity = async (cartId, quantity) => {
    try {
      if (quantity <= 0) {
        await removeFromCart(cartId);
        return;
      }

      // First update local state for immediate UI response
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.cartId === cartId ? { ...item, quantity } : item
        )
      );
      
      // Then sync with API
      await api.updateUserCartItem(cartId, quantity);
      
      // Reload cart from API to ensure consistency
      await loadCart();
      
    } catch (error) {
      console.log('Error updating quantity via API:', error);
      // If API fails, reload from local storage
      await loadCart();
    }
  };

  const clearCart = async () => {
    try {
      // First update local state for immediate UI response
      setCartItems([]);
      
      // Then sync with API
      await api.clearUserCart();
      
      // Reload cart from API to ensure consistency
      await loadCart();
      
    } catch (error) {
      console.log('Error clearing cart via API:', error);
      // If API fails, reload from local storage
      await loadCart();
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
    loadCart();
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    cartItems,
    isLoading,
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
  }), [cartItems, isLoading]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};