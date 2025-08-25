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

  const [orders, setOrders] = useState([
    {
      id: 'ORD-001',
      date: '2024-01-15',
      status: 'Delivered',
      total: 156.99,
      items: [
        {
          id: '1',
          name: 'Linen Dress',
          price: '$52.00',
          quantity: 2,
          image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/92265483-9E7E-4FC3-A355-16CCA677C11C_zbsxfe.png',
          size: 'M',
          color: 'Blue'
        },
        {
          id: '2',
          name: 'Maxi Dress',
          price: '$68.00',
          quantity: 1,
          image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_01_zfhxws.png',
          size: 'L',
          color: 'Black'
        }
      ],
      shippingAddress: '123 Main Street, City, State 12345',
      paymentMethod: 'Credit Card ending in 1234'
    },
    {
      id: 'ORD-002',
      date: '2024-01-10',
      status: 'Processing',
      total: 89.99,
      items: [
        {
          id: '3',
          name: 'Front Tie Mini Dress',
          price: '$59.00',
          quantity: 1,
          image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410274/32EB245A-E30D-4D15-B57A-23A577C43459_f3x5xd.png',
          size: 'S',
          color: 'Red'
        }
      ],
      shippingAddress: '456 Business Ave, Downtown, State 67890',
      paymentMethod: 'PayPal'
    }
  ]);

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
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.login(email, password);
      
      const { token: authToken, user: userData } = response;
      
      // Store token and user data
      await AsyncStorage.setItem('authToken', authToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      setToken(authToken);
      setUser(userData);
      
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
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Registration failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      
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
      return { success: false, error: error.message };
    }
  };

  const addOrder = (orderData) => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Processing',
      ...orderData
    };
    setOrders(prevOrders => [newOrder, ...prevOrders]);
    return newOrder;
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