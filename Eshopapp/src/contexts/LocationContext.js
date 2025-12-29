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
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Load user's default address on app start
  useEffect(() => {
    loadUserDefaultAddress();
  }, []);

  const loadUserDefaultAddress = async () => {
    try {
      // First try local storage (fast path)
      const storedAddresses = await AsyncStorage.getItem('userAddresses');
      const storedDefaultId = await AsyncStorage.getItem('defaultAddressId');
      if (storedAddresses) {
        const parsed = JSON.parse(storedAddresses);
        const fallback = parsed.find(a => a.isDefault) || parsed[0];
        const chosen = (storedDefaultId && parsed.find(a => a.id === storedDefaultId)) || fallback;
        if (chosen) {
          setAddress(chosen.address || '');
          setArea('');
          setCity(chosen.city || '');
          setPostalCode(chosen.zipCode || chosen.postalCode || '');
          if (chosen.location?.coordinates) {
            setLocation({ latitude: chosen.location.coordinates[1], longitude: chosen.location.coordinates[0] });
          }
        }
      }
      // Then try API (authoritative path)
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      const response = await api.request('/api/v1/users/me/addresses', { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        const def = response.data.find(a => a.isDefault) || response.data[0];
        const nextLocation = def.location?.coordinates ? { latitude: def.location.coordinates[1], longitude: def.location.coordinates[0] } : null;
        setAddress(def.address || '');
        setArea('');
        setCity(def.city || '');
        setPostalCode(def.zipCode || def.postalCode || '');
        if (nextLocation) setLocation(nextLocation);
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
        if (locationData.area) setArea(locationData.area);
        if (locationData.city) setCity(locationData.city);
        if (locationData.postalCode) setPostalCode(locationData.postalCode);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAddress = (newAddress) => {
    // If newAddress is a string, just update address
    if (typeof newAddress === 'string') {
      setAddress(newAddress);
    } else if (typeof newAddress === 'object' && newAddress !== null) {
      // If it's an object, update all address fields
      if (newAddress.address !== undefined) setAddress(newAddress.address || '');
      if (newAddress.city !== undefined) setCity(newAddress.city || '');
      if (newAddress.area !== undefined) setArea(newAddress.area || '');
      if (newAddress.postalCode !== undefined || newAddress.zipCode !== undefined) {
        setPostalCode(newAddress.postalCode || newAddress.zipCode || '');
      }
      if (newAddress.location) {
        setLocation({
          latitude: newAddress.location.latitude || newAddress.location.coordinates?.[1],
          longitude: newAddress.location.longitude || newAddress.location.coordinates?.[0],
        });
      }
    }
  };

  const value = {
    location,
    address,
    area,
    city,
    postalCode,
    isLoading,
    requestLocation,
    updateAddress,
    setLocation,
    setAddress,
    setArea,
    setCity,
    setPostalCode,
    loadUserDefaultAddress,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};