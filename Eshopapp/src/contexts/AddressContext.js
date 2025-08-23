import React, { createContext, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AddressContext = createContext();

export const useAddress = () => {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddress must be used within an AddressProvider');
  }
  return context;
};

export const AddressProvider = ({ children }) => {
  const [addresses, setAddresses] = useState([]);
  const [defaultAddressId, setDefaultAddressId] = useState(null);

  // Load addresses from storage on app start
  React.useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const storedAddresses = await AsyncStorage.getItem('userAddresses');
      const storedDefaultId = await AsyncStorage.getItem('defaultAddressId');
      
      if (storedAddresses) {
        setAddresses(JSON.parse(storedAddresses));
      }
      if (storedDefaultId) {
        setDefaultAddressId(storedDefaultId);
      }
    } catch (error) {
      console.log('Error loading addresses:', error);
    }
  };

  const saveAddresses = async (newAddresses) => {
    try {
      await AsyncStorage.setItem('userAddresses', JSON.stringify(newAddresses));
    } catch (error) {
      console.log('Error saving addresses:', error);
    }
  };

  const addAddress = async (address) => {
    const newAddress = {
      id: Date.now().toString(),
      ...address,
      isDefault: addresses.length === 0, // First address becomes default
      createdAt: new Date().toISOString()
    };

    const newAddresses = [...addresses, newAddress];
    setAddresses(newAddresses);
    
    if (newAddress.isDefault) {
      setDefaultAddressId(newAddress.id);
      await AsyncStorage.setItem('defaultAddressId', newAddress.id);
    }
    
    await saveAddresses(newAddresses);
    return newAddress;
  };

  const updateAddress = async (id, updates) => {
    const newAddresses = addresses.map(addr => 
      addr.id === id ? { ...addr, ...updates, updatedAt: new Date().toISOString() } : addr
    );
    
    setAddresses(newAddresses);
    await saveAddresses(newAddresses);
  };

  const deleteAddress = async (id) => {
    const addressToDelete = addresses.find(addr => addr.id === id);
    const newAddresses = addresses.filter(addr => addr.id !== id);
    
    setAddresses(newAddresses);
    await saveAddresses(newAddresses);
    
    // If deleted address was default, set new default
    if (addressToDelete?.isDefault && newAddresses.length > 0) {
      const newDefault = newAddresses[0];
      newDefault.isDefault = true;
      setDefaultAddressId(newDefault.id);
      await AsyncStorage.setItem('defaultAddressId', newDefault.id);
      await saveAddresses(newAddresses);
    }
  };

  const setDefaultAddress = async (id) => {
    const newAddresses = addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    }));
    
    setAddresses(newAddresses);
    setDefaultAddressId(id);
    await AsyncStorage.setItem('defaultAddressId', id);
    await saveAddresses(newAddresses);
  };

  const getDefaultAddress = () => {
    return addresses.find(addr => addr.isDefault) || addresses[0];
  };

  const getAddressById = (id) => {
    return addresses.find(addr => addr.id === id);
  };

  const value = {
    addresses,
    defaultAddressId,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress,
    getAddressById,
    loadAddresses
  };

  return (
    <AddressContext.Provider value={value}>
      {children}
    </AddressContext.Provider>
  );
};