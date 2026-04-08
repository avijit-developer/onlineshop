import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [wishlistStatus, setWishlistStatus] = useState({}); // productId -> boolean

  const loadWishlist = useCallback(async () => {
    try {
      console.log('WishlistProvider: Starting to load wishlist');
      setIsLoading(true);
      const response = await api.getWishlist();
      console.log('WishlistProvider: API response:', response);
      const wishlistItems = response.data || [];
      console.log('WishlistProvider: Wishlist items:', wishlistItems);
      setWishlist(wishlistItems);
      
      // Update wishlist status for all products
      const statusMap = {};
      wishlistItems.forEach(item => {
        statusMap[item._id] = true;
      });
      setWishlistStatus(statusMap);
      console.log('WishlistProvider: Wishlist status map:', statusMap);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      // Don't show error for initial load if user is not logged in
      // Set empty wishlist on error
      setWishlist([]);
      setWishlistStatus({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load wishlist on mount
  useEffect(() => {
    console.log('WishlistProvider: Loading wishlist on mount');
    loadWishlist();
  }, [loadWishlist]);

  const addToWishlist = useCallback(async (productId) => {
    try {
      await api.addToWishlist(productId);
      
      // Update local state
      setWishlistStatus(prev => ({
        ...prev,
        [productId]: true
      }));
      
      // Reload wishlist to get updated data
      await loadWishlist();
      
      return { success: true };
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      return { success: false, error: error.message };
    }
  }, [loadWishlist]);

  const removeFromWishlist = useCallback(async (productId) => {
    try {
      await api.removeFromWishlist(productId);
      
      // Update local state
      setWishlistStatus(prev => ({
        ...prev,
        [productId]: false
      }));
      
      // Remove from wishlist array
      setWishlist(prev => prev.filter(item => item._id !== productId));
      
      return { success: true };
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const toggleWishlist = useCallback(async (productId) => {
    const inList = wishlistStatus[productId];
    if (inList) {
      return await removeFromWishlist(productId);
    }
    return await addToWishlist(productId);
  }, [wishlistStatus, addToWishlist, removeFromWishlist]);

  const checkWishlistStatus = useCallback(async (productId) => {
    try {
      const response = await api.checkWishlistStatus(productId);
      const isInWishlist = response.data.isInWishlist;
      
      setWishlistStatus(prev => ({
        ...prev,
        [productId]: isInWishlist
      }));
      
      return isInWishlist;
    } catch (error) {
      console.error('Error checking wishlist status:', error);
      return false;
    }
  }, []);

  const getWishlistCount = useCallback(() => wishlist.length, [wishlist]);

  const isInWishlist = useCallback((productId) => wishlistStatus[productId] || false, [wishlistStatus]);

  const resetWishlist = useCallback(() => {
    setWishlist([]);
    setWishlistStatus({});
    setIsLoading(false);
  }, []);

  const value = useMemo(() => ({
    wishlist,
    isLoading,
    wishlistStatus,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    checkWishlistStatus,
    loadWishlist,
    getWishlistCount,
    isInWishlist,
    resetWishlist,
  }), [wishlist, isLoading, wishlistStatus, addToWishlist, removeFromWishlist, toggleWishlist, checkWishlistStatus, loadWishlist, getWishlistCount, isInWishlist, resetWishlist]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};
