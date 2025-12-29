import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [orders, setOrders] = useState([]);

  const [addresses, setAddresses] = useState([
    {
      id: '1',
      label: 'Home',
      name: 'John Doe',
      phone: '+1 234 567 8900',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '12345',
      country: 'United States',
      isDefault: true,
    },
    {
      id: '2',
      label: 'Work',
      name: 'John Doe',
      phone: '+1 234 567 8900',
      address: '456 Business Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '67890',
      country: 'United States',
      isDefault: false,
    }
  ]);

  // Load stored token and user data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        try { const mine = await api.getMyOrders(); if (mine?.success) setOrders(mine.data || []); } catch (_) {}
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone, password) => {
    try {
      const response = await api.login(phone, password);
      
      const { token: authToken, user: userData } = response;
      
      // Store token and user data
      await AsyncStorage.setItem('authToken', authToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      setToken(authToken);
      setUser(userData);
      // Fetch orders in background to avoid blocking login
      setTimeout(async () => { try { const mine = await api.getMyOrders(); if (mine?.success) setOrders(mine.data || []); } catch (_) {} }, 0);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      
      const { token: authToken, user: newUser } = response;
      
      // Store token and user data
      await AsyncStorage.setItem('authToken', authToken);
      await AsyncStorage.setItem('userData', JSON.stringify(newUser));
      
      setToken(authToken);
      setUser(newUser);
      // Fetch orders in background to avoid blocking register
      setTimeout(async () => { try { const mine = await api.getMyOrders(); if (mine?.success) setOrders(mine.data || []); } catch (_) {} }, 0);
      
      return { success: true };
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('email already in use')) {
        return { success: false, error: 'An account with this email already exists' };
      }
      if (message.includes('phone number already in use')) {
        return { success: false, error: 'An account with this phone number already exists' };
      }
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      // Clear user addresses on logout to prevent showing other user's addresses
      await AsyncStorage.removeItem('userAddresses');
      await AsyncStorage.removeItem('defaultAddressId');
      
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const updateUser = async (userData) => {
    try {
      let response;
      
      // If there's an image file to upload, handle it separately
      if (userData.selectedImageFile) {
        // Upload image first
        const imageResponse = await api.uploadProfilePicture(token, userData.selectedImageFile);
        
        // Then update profile with the new avatar URL
        const { selectedImageFile, ...profileData } = userData;
        const profileResponse = await api.updateUserProfile(token, {
          ...profileData,
          avatar: imageResponse.data.avatar
        });
        
        response = profileResponse;
      } else {
        // Regular profile update
        response = await api.updateUserProfile(token, userData);
      }
      
      // Update local state with the response from server
      const updatedUser = { ...user, ...response.data };
      setUser(updatedUser);
      
      // Update stored user data
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('email already in use')) {
        return { success: false, error: 'This email is already taken' };
      }
      if (message.includes('phone number already in use')) {
        return { success: false, error: 'This phone number is already taken' };
      }
      return { success: false, error: error.message };
    }
  };

  const addOrder = (orderData) => {
    // Keep for UI previews; prefer backend fetch after creation.
    setOrders(prevOrders => [orderData, ...prevOrders]);
    return orderData;
  };

  const refreshOrders = async () => {
    try {
      const res = await api.getMyOrders();
      if (res?.success) setOrders(res.data || []);
    } catch (_) {}
  };

  const addAddress = (addressData) => {
    const newAddress = {
      id: Date.now().toString(),
      isDefault: addresses.length === 0,
      ...addressData
    };
    setAddresses(prevAddresses => [...prevAddresses, newAddress]);
    return newAddress;
  };

  const updateAddress = (addressId, addressData) => {
    setAddresses(prevAddresses =>
      prevAddresses.map(addr =>
        addr.id === addressId ? { ...addr, ...addressData } : addr
      )
    );
  };

  const deleteAddress = (addressId) => {
    setAddresses(prevAddresses => prevAddresses.filter(addr => addr.id !== addressId));
  };

  const setDefaultAddress = (addressId) => {
    setAddresses(prevAddresses =>
      prevAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === addressId
      }))
    );
  };

  const value = {
    user,
    token,
    isLoading,
    orders,
    addresses,
    login,
    register,
    logout,
    updateUser,
    addOrder,
    refreshOrders,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};