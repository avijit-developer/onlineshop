
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
  const [cartCoupon, setCartCoupon] = useState(null);
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

  // Watch for auth token changes (login/logout) and refresh cart
  useEffect(() => {
    let isMounted = true;
    let checkInterval = null;
    
    const watchAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const wasAuthenticated = isAuthenticated;
        const isNowAuthenticated = !!token;
        
        // If auth state changed (login or logout), refresh cart
        if (wasAuthenticated !== isNowAuthenticated) {
          setIsAuthenticated(isNowAuthenticated);
          if (isNowAuthenticated) {
            // User just logged in - force refresh cart
            console.log('Auth token detected, refreshing cart...');
            await loadCart(true); // Force load
          } else {
            // User just logged out - clear cart
            setCartItems([]);
            setCartCoupon(null);
          }
        } else if (isNowAuthenticated && isInitialized) {
          // User is authenticated and cart is initialized - periodically check for updates
          // This handles the case where user logs in but cart wasn't loaded initially
          if (cartItems.length === 0) {
            console.log('User authenticated but cart empty, refreshing...');
            await loadCart(true); // Force load
          }
        }
      } catch (error) {
        console.log('Error watching auth token:', error);
      }
    };
    
    // Check immediately
    watchAuthToken();
    
    // Set up interval to check for auth token changes (every 1 second for first 10 seconds)
    let checkCount = 0;
    checkInterval = setInterval(() => {
      if (isMounted && checkCount < 10) {
        watchAuthToken();
        checkCount++;
      } else if (checkCount >= 10 && checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [isAuthenticated, isInitialized, cartItems.length]);

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
        await loadCart(true); // Force load on initial check
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

  // Watch for auth token changes (login/logout) and refresh cart
  useEffect(() => {
    let isMounted = true;
    let checkInterval = null;
    let lastToken = null;
    
    const watchAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        
        // If token changed (login or logout), refresh cart
        if (token !== lastToken) {
          lastToken = token;
          const wasAuthenticated = isAuthenticated;
          const isNowAuthenticated = !!token;
          
          if (wasAuthenticated !== isNowAuthenticated && isMounted) {
            setIsAuthenticated(isNowAuthenticated);
            if (isNowAuthenticated) {
              // User just logged in - force refresh cart
              console.log('Auth token detected, refreshing cart...');
              await loadCart(true); // Force load
            } else {
              // User just logged out - clear cart
              setCartItems([]);
              setCartCoupon(null);
            }
          }
        } else if (isNowAuthenticated && isInitialized && cartItems.length === 0 && isMounted) {
          // User is authenticated, cart initialized but empty - refresh once
          console.log('User authenticated but cart empty, refreshing...');
          await loadCart(true); // Force load
        }
      } catch (error) {
        console.log('Error watching auth token:', error);
      }
    };
    
    // Check immediately
    watchAuthToken();
    
    // Set up interval to check for auth token changes (every 1 second for first 5 seconds after mount)
    let checkCount = 0;
    checkInterval = setInterval(() => {
      if (isMounted && checkCount < 5) {
        watchAuthToken();
        checkCount++;
      } else if (checkCount >= 5 && checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [isAuthenticated, isInitialized, cartItems.length]);

  const loadCart = async (force = false) => {
    // Prevent multiple simultaneous cart loads using ref
    if (isLoadingCartRef.current) {
      console.log('Cart load already in progress (ref), skipping...');
      return;
    }
    
    // Throttle cart loads to prevent excessive API calls unless forced
    const now = Date.now();
    if (!force && (now - lastCartLoadTime.current < CART_LOAD_THROTTLE)) {
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
          // Prefer variant price/special if variant selected; otherwise use admin-approved base prices
          const variantPreferredPrice = (item.variantInfo?.specialPrice != null)
            ? item.variantInfo.specialPrice
            : (item.variantInfo?.price != null ? item.variantInfo.price : undefined);
          const basePreferredPrice = (item.product.specialPrice != null)
            ? item.product.specialPrice
            : item.product.regularPrice;
          const calculatedPrice = (variantPreferredPrice != null) ? variantPreferredPrice : basePreferredPrice;

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
            sku: item.product.sku,
            enabled: (typeof item.product.enabled === 'boolean') ? item.product.enabled : true,
            status: item.product.status
          };
        });
        setCartItems(transformedItems);
        // Persist coupon state from backend cart into context so UI can restore after reload
        if (response.data.couponCode) {
          setCartCoupon({
            couponCode: response.data.couponCode,
            discountAmount: Number(response.data.couponDiscount || 0),
            freeShipping: !!response.data.freeShippingApplied,
          });
        } else {
          setCartCoupon(null);
        }
        console.log('Loaded cart from database:', transformedItems.length, 'items');
      } else {
        setCartItems([]);
        setCartCoupon(null);
        console.log('No cart data found in database');
      }
    } catch (error) {
      console.log('Error loading cart from database:', error);
      setCartItems([]);
      setCartCoupon(null);
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
      // Ensure authentication is synced with stored token on first interaction
      const storedToken = await AsyncStorage.getItem('authToken');
      if (!isAuthenticated && storedToken) {
        setIsAuthenticated(true);
      }
      if (!isAuthenticated && !storedToken) {
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
        await loadCart(true);
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
      // Optimistic UI update
      const prevItems = cartItems;
      const prevCoupon = cartCoupon;
      setCartItems(prev => prev.filter(item => item.cartId === cartId ? false : true));
      // Invalidate coupon locally to mirror backend behavior on cart changes
      setCartCoupon(null);

      try {
        const response = await api.removeFromUserCart(cartId);
        if (response && response.success) {
          await loadCart(true);
        } else {
          console.log('Failed to remove item from cart in database');
          // Revert on failure
          setCartItems(prevItems);
          setCartCoupon(prevCoupon);
        }
      } catch (e) {
        // Revert on error
        setCartItems(prevItems);
        setCartCoupon(prevCoupon);
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
      // Optimistic UI update
      const prevItems = cartItems;
      const prevCoupon = cartCoupon;
      setCartItems(prev => prev.map(item => item.cartId === cartId ? { ...item, quantity } : item));
      // Invalidate coupon locally to mirror backend behavior
      setCartCoupon(null);

      try {
        const response = await api.updateUserCartItem(cartId, quantity);
        if (response && response.success) {
          await loadCart(true);
        } else {
          console.log('Failed to update quantity in database');
          // Revert on failure
          setCartItems(prevItems);
          setCartCoupon(prevCoupon);
        }
      } catch (e) {
        // Revert on error
        setCartItems(prevItems);
        setCartCoupon(prevCoupon);
      }
      
    } catch (error) {
      console.log('Error updating quantity:', error);
    }
  };

  const clearCart = async () => {
    try {
      // Proceed if either context auth is true OR a stored token exists
      let canProceed = isAuthenticated;
      if (!canProceed) {
        const storedToken = await AsyncStorage.getItem('authToken');
        if (storedToken) {
          setIsAuthenticated(true);
          canProceed = true;
        }
      }
      if (!canProceed) { console.log('User not authenticated, cannot clear cart'); return; }

      console.log('Clearing cart via database');
      try {
        const response = await api.clearUserCart();
        if (!response || !response.success) {
          console.log('Clear cart response not successful, proceeding to clear local state');
        }
      } catch (e) {
        // Treat 404 or network issues as idempotent success for local UI
        console.log('Clear cart API error treated as success:', e?.message || e);
      }
      // Immediately clear the local state for instant UI update
      setCartItems([]);
      setCartCoupon(null);
      console.log('Cart cleared (local state updated)');
      // Defer reload; local state shows empty immediately. Subscribers stay consistent.
      
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
 
    
    // Prefer variant special price, then variant price, then base special, base regular, finally item.price
    if (item.variantInfo?.specialPrice != null) {
      console.log('✅ Using variantInfo.specialPrice:', item.variantInfo.specialPrice);
      return Number(item.variantInfo.specialPrice);
    }
    if (item.variantInfo?.price != null) {
      console.log('✅ Using variantInfo.price:', item.variantInfo.price);
      return Number(item.variantInfo.price);
    }
    if (item.specialPrice != null) {
     //console.log('✅ Using item.specialPrice:', item.specialPrice);
      return Number(item.specialPrice);
    }
    if (item.regularPrice != null) {
     // console.log('✅ Using item.regularPrice:', item.regularPrice);
      return Number(item.regularPrice);
    }
    if (item.price != null) {
      console.log('✅ Using item.price fallback:', item.price);
      return Number(item.price);
    }
    return 0;
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

  const refreshCart = useCallback(async (force = true) => {
    console.log('🔄 refreshCart called', force ? '(forced)' : '');
    await loadCart(force);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    cartItems,
    isLoading,
    isAuthenticated,
    cartCoupon,
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