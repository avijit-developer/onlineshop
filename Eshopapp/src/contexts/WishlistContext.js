import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Load wishlist on mount
  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      setIsLoading(true);
      const response = await api.getWishlist();
      const wishlistItems = response.data || [];
      setWishlist(wishlistItems);
      
      // Update wishlist status for all products
      const statusMap = {};
      wishlistItems.forEach(item => {
        statusMap[item._id] = true;
      });
      setWishlistStatus(statusMap);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      // Don't show error for initial load if user is not logged in
    } finally {
      setIsLoading(false);
    }
  };

  const addToWishlist = async (productId) => {
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
  };

  const removeFromWishlist = async (productId) => {
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
  };

  const toggleWishlist = async (productId) => {
    const isInWishlist = wishlistStatus[productId];
    
    if (isInWishlist) {
      return await removeFromWishlist(productId);
    } else {
      return await addToWishlist(productId);
    }
  };

  const checkWishlistStatus = async (productId) => {
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
  };

  const getWishlistCount = () => {
    return wishlist.length;
  };

  const isInWishlist = (productId) => {
    return wishlistStatus[productId] || false;
  };

  const value = {
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
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};