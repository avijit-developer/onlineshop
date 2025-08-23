
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


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

  // Load cart data from storage when app starts
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart data whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveCart();
    }
  }, [cartItems, isLoading]);

  const loadCart = async () => {
    try {
      const storedCart = await AsyncStorage.getItem('cartData');
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        console.log('Loaded cart from storage:', parsedCart.length, 'items');
        setCartItems(parsedCart);
      } else {
        console.log('No stored cart data found');
      }
    } catch (error) {
      console.log('Error loading cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem('cartData', JSON.stringify(cartItems));
      console.log('Cart saved to storage:', cartItems.length, 'items');
    } catch (error) {
      console.log('Error saving cart:', error);
    }
  };

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
            ? { 
                ...item, 
                quantity: quantity, // Replace quantity, don't add
                // Ensure images are still accessible
                images: item.images || item.image ? [item.image] : [],
                // Update variant info if needed
                variantInfo: item.variantInfo ? {
                  ...item.variantInfo,
                  images: item.variantInfo.images || []
                } : null
              }
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
        // Ensure images are accessible - handle both arrays and strings
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
          // For simple products, try to get images from currentImages if it's a function result
          if (product.currentImages && Array.isArray(product.currentImages) && product.currentImages.length > 0) {
            return product.currentImages;
          }
          return [];
        })(),
        // Store variant-specific information
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
  }), [cartItems]);


  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};