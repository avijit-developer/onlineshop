import React, { createContext, useContext, useState, useEffect } from 'react';
import { requestLocationAndGetAddress } from '../utils/locationUtils';

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
  const [address, setAddress] = useState('Downtown Area, NY');
  const [isLoading, setIsLoading] = useState(false);

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
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};