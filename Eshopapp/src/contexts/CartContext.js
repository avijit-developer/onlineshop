
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingCart, setIsLoadingCart] = useState(false);
  const isLoadingCartRef = useRef(false);
  const lastCartLoadTime = useRef(0);
  const CART_LOAD_THROTTLE = 5000; // 5 seconds
  const LOCAL_CART_KEY = 'localCartItems';

  // Check authentication status and load cart
  useEffect(() => {
    let isMounted = true;
    
    const initCart = async () => {
      if (isMounted) {
        await checkAuthAndLoadCart();
      }
    };
    
    initCart();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const checkAuthAndLoadCart = async () => {
    // Prevent multiple initializations
    if (isInitialized) {
      return;
    }
    
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
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.log('Error checking authentication:', error);
      setIsAuthenticated(false);
      setCartItems([]);
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCart = async () => {
    // Prevent multiple simultaneous cart loads using ref
    if (isLoadingCartRef.current) {
      console.log('Cart load already in progress (ref), skipping...');
      return;
    }
    
    // Throttle cart loads to prevent excessive API calls
    const now = Date.now();
    if (now - lastCartLoadTime.current < CART_LOAD_THROTTLE) {
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setCartItems([]);
        return;
      }

      isLoadingCartRef.current = true;
      setIsLoadingCart(true);
      lastCartLoadTime.current = now;
      const response = await api.getUserCart();
      if (response && response.success && response.data) {
        // Transform API cart data to match frontend format
        const transformedItems = response.data.items.map(item => {
          // Calculate the correct price (special price if available, otherwise regular price)
          const calculatedPrice = (item.product.specialPrice !== null && item.product.specialPrice !== undefined) 
            ? item.product.specialPrice 
            : item.product.regularPrice;
          
          return {
            id: item.product._id || item.product.id,
            name: item.product.name,
            cartId: item.cartId,
            quantity: item.quantity,
            // Set the calculated price field
            price: calculatedPrice,
            selectedAttributes: item.selectedAttributes ? (typeof item.selectedAttributes.toJSON === 'function' ? item.selectedAttributes.toJSON() : (typeof item.selectedAttributes === 'object' ? item.selectedAttributes : {})) : {},
            variantInfo: item.variantInfo ? {
              attributes: item.variantInfo.attributes ? (typeof item.variantInfo.attributes.toJSON === 'function' ? item.variantInfo.attributes.toJSON() : (typeof item.variantInfo.attributes === 'object' ? item.variantInfo.attributes : {})) : {},
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
          };
        });
        setCartItems(transformedItems);
        console.log('Loaded cart from database:', transformedItems.length, 'items');
      } else {
        setCartItems([]);
        console.log('No cart data found in database');
      }
    } catch (error) {
      console.log('Error loading cart from database:', error);
      setCartItems([]);
    } finally {
      setIsLoadingCart(false);
      isLoadingCartRef.current = false;
    }
  };

  const loadLocalCart = async () => {
    try {
      const stored = await AsyncStorage.getItem(LOCAL_CART_KEY);
      const items = stored ? JSON.parse(stored) : [];
      setCartItems(items);
      console.log('Loaded cart from local storage:', items.length, 'items');
    } catch (error) {
      console.log('Error loading local cart:', error);
      setCartItems([]);
    }
  };

  const saveLocalCart = async (items) => {
    try {
      await AsyncStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
    } catch (error) {
      console.log('Error saving local cart:', error);
    }
  };

  const addToCart = async (product, quantity = 1, selectedAttributes = null) => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot add to cart');
        return { success: false, error: 'Not authenticated' };
      }

      // Normalize product payload to ensure backend compatibility
      const parseNumericPrice = (p) => {
        if (typeof p === 'number') return p;
        if (typeof p === 'string') {
          const cleaned = p.replace(/[^0-9.]/g, '');
          const num = parseFloat(cleaned);
          return isNaN(num) ? undefined : num;
        }
        return undefined;
      };

      const productId = (product && (product._id || product.id)) ? (product._id || product.id) : (typeof product === 'string' ? product : undefined);
      if (!productId) {
        console.log('addToCart: Invalid product payload, missing id/_id');
        return { success: false, error: 'Invalid product' };
      }

      const normalizedProduct = {
        // Ensure both _id and id are present for backend lookups
        _id: String(productId),
        id: String(productId),
        // Use the price field if provided, otherwise fall back to regular price
        price: product?.price ?? product?.regularPrice ?? parseNumericPrice(product?.price),
        // Carry forward fields the backend/cart model may utilize for images/pricing
        regularPrice: product?.regularPrice ?? parseNumericPrice(product?.price),
        specialPrice: product?.specialPrice ?? undefined,
        stock: product?.stock ?? product?.currentStock ?? undefined,
        sku: product?.sku ?? product?.selectedVariant?.sku,
        images: Array.isArray(product?.images)
          ? product.images
          : (Array.isArray(product?.currentImages) ? product.currentImages : (product?.image ? [product.image] : [])),
        // Preserve selectedVariant if provided (for configurable products)
        selectedVariant: product?.selectedVariant ?? undefined,
      };

      console.log('🔍 CartContext Debug - Original product:', product);
      console.log('🔍 CartContext Debug - Normalized product:', normalizedProduct);
      console.log('Adding to cart via database:', product?.name || normalizedProduct._id, quantity, selectedAttributes);
      const response = await api.addToUserCart(normalizedProduct, quantity, selectedAttributes);
      if (response && response.success) {
        await loadCart();
        return { success: true };
      } else {
        const message = response?.message || 'Failed to add item to cart in database';
        console.log(message);
        return { success: false, error: message };
      }
      
    } catch (error) {
      console.log('Error adding to cart:', error);
      return { success: false, error: error?.message || 'Failed to add item to cart' };
    }
  };

  const removeFromCart = async (cartId) => {
    try {
      if (!isAuthenticated) {
        console.log('User not authenticated, cannot remove from cart');
        return;
      }

      console.log('Removing item from cart via database:', cartId);
      const response = await api.removeFromUserCart(cartId);
      if (response && response.success) {
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
      const response = await api.updateUserCartItem(cartId, quantity);
      if (response && response.success) {
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
      const response = await api.clearUserCart();
      if (response && response.success) {
        // Immediately clear the local state for instant UI update
        setCartItems([]);
        console.log('Cart cleared successfully, local state updated');
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
    console.log('🔍 getItemPrice Debug - Item:', {
      id: item._id || item.id,
      price: item.price,
      regularPrice: item.regularPrice,
      specialPrice: item.specialPrice,
      variantInfo: item.variantInfo
    });
    
    // Use the price field first if available (this is set by our getCartPrice logic)
    if (item.price && item.price > 0) {
      console.log('✅ Using item.price:', item.price);
      return item.price;
    }
    // Use variant price if available, otherwise fall back to regular price
    if (item.variantInfo?.price) {
      console.log('✅ Using variantInfo.price:', item.variantInfo.price);
      return item.variantInfo.price;
    }
    if (item.variantInfo?.specialPrice && item.variantInfo.specialPrice < item.variantInfo.price) {
      console.log('✅ Using variantInfo.specialPrice:', item.variantInfo.specialPrice);
      return item.variantInfo.specialPrice;
    }
    if (item.regularPrice) {
      console.log('✅ Using item.regularPrice:', item.regularPrice);
      return item.regularPrice;
    }
    if (item.specialPrice && item.specialPrice < item.regularPrice) {
      console.log('✅ Using item.specialPrice:', item.specialPrice);
      return item.specialPrice;
    }
    console.log('✅ Using parsePrice(item.price):', parsePrice(item.price));
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

  const refreshCart = useCallback(async () => {
    console.log('🔄 refreshCart called');
    await loadCart();
  }, []);

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
  }), [cartItems, isLoading, isAuthenticated, isInitialized]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};