import React, { createContext, useContext, useState, useEffect } from 'react';
import { requestLocationAndGetAddress } from '../utils/locationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

const LocationContext = createContext();

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Select your location');
  const [isLoading, setIsLoading] = useState(false);

  // Load user's default address on app start
  useEffect(() => {
    loadUserDefaultAddress();
  }, []);

  const loadUserDefaultAddress = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await api.request('/api/v1/users/me/addresses', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.success && response.data && response.data.length > 0) {
        const defaultAddress = response.data.find(addr => addr.isDefault) || response.data[0];
        setAddress(defaultAddress.address);
        if (defaultAddress.location?.coordinates) {
          setLocation({
            latitude: defaultAddress.location.coordinates[1],
            longitude: defaultAddress.location.coordinates[0],
          });
        }
      }
    } catch (error) {
      console.error('Failed to load user address:', error);
    }
  };

  const requestLocation = async () => {
    setIsLoading(true);
    try {
      const locationData = await requestLocationAndGetAddress();
      if (locationData) {
        setLocation({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
        setAddress(locationData.address);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAddress = (newAddress) => {
    setAddress(newAddress);
  };

  const value = {
    location,
    address,
    isLoading,
    requestLocation,
    updateAddress,
    setLocation,
    setAddress,
    loadUserDefaultAddress,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};