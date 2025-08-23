
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

  // Load cart data from local storage first, then try API sync
  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setIsLoading(true);
      
      // First, try to load from local storage for immediate access
      const storedCart = await AsyncStorage.getItem('cartData');
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        setCartItems(parsedCart);
        console.log('Loaded cart from local storage:', parsedCart.length, 'items');
      }

      // Then try to sync with API if user is logged in
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          console.log('User is logged in, syncing with API...');
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
            
            // Update state with API data
            setCartItems(transformedItems);
            
            // Save API data to local storage
            await AsyncStorage.setItem('cartData', JSON.stringify(transformedItems));
            console.log('Synced cart with API and saved to local storage:', transformedItems.length, 'items');
          }
        } else {
          console.log('No auth token found, using local storage only');
        }
      } catch (apiError) {
        console.log('API sync failed, using local storage:', apiError);
        // API failed, but we already have local data loaded
      }
      
    } catch (error) {
      console.log('Error loading cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToLocalStorage = async (items) => {
    try {
      await AsyncStorage.setItem('cartData', JSON.stringify(items));
      console.log('Cart saved to local storage:', items.length, 'items');
    } catch (error) {
      console.log('Error saving to local storage:', error);
    }
  };

  const addToCart = async (product, quantity = 1, selectedAttributes = null) => {
    try {
      console.log('Adding to cart:', product.name, quantity, selectedAttributes);
      
      // Update local state immediately
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
          const updated = prevItems.map(item =>
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
          
          // Save to local storage immediately
          saveToLocalStorage(updated);
          return updated;
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
        
        const newItems = [...prevItems, newItem];
        
        // Save to local storage immediately
        saveToLocalStorage(newItems);
        return newItems;
      });

      // Try to sync with API in background (don't wait for it)
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          api.addToUserCart(product, quantity, selectedAttributes).catch(error => {
            console.log('Background API sync failed:', error);
          });
        }
      } catch (error) {
        console.log('Error in background API sync:', error);
      }
      
    } catch (error) {
      console.log('Error adding to cart:', error);
    }
  };

  const removeFromCart = async (cartId) => {
    try {
      // Update local state immediately
      setCartItems(prevItems => {
        const newItems = prevItems.filter(item => item.cartId !== cartId);
        saveToLocalStorage(newItems);
        return newItems;
      });

      // Try to sync with API in background
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          api.removeFromUserCart(cartId).catch(error => {
            console.log('Background API sync failed:', error);
          });
        }
      } catch (error) {
        console.log('Error in background API sync:', error);
      }
      
    } catch (error) {
      console.log('Error removing from cart:', error);
    }
  };

  const updateQuantity = async (cartId, quantity) => {
    try {
      if (quantity <= 0) {
        await removeFromCart(cartId);
        return;
      }

      // Update local state immediately
      setCartItems(prevItems => {
        const newItems = prevItems.map(item =>
          item.cartId === cartId ? { ...item, quantity } : item
        );
        saveToLocalStorage(newItems);
        return newItems;
      });

      // Try to sync with API in background
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          api.updateUserCartItem(cartId, quantity).catch(error => {
            console.log('Background API sync failed:', error);
          });
        }
      } catch (error) {
        console.log('Error in background API sync:', error);
      }
      
    } catch (error) {
      console.log('Error updating quantity:', error);
    }
  };

  const clearCart = async () => {
    try {
      // Update local state immediately
      setCartItems([]);
      await saveToLocalStorage([]);

      // Try to sync with API in background
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          api.clearUserCart().catch(error => {
            console.log('Background API sync failed:', error);
          });
        }
      } catch (error) {
        console.log('Error in background API sync:', error);
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