import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

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
  const [isLoading, setIsLoading] = useState(false);

  const isLoadingRef = React.useRef(false);
  const lastLoadTimeRef = React.useRef(0);
  const ADDRESSES_LOAD_THROTTLE = 5000; // 5 seconds

  const transformApiAddresses = (apiList) => (apiList || []).map(addr => {
    // Split the name field into firstName and lastName
    const nameParts = (addr.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    return {
      id: addr._id || addr.id,
      _originalId: addr._id, // Preserve original MongoDB ObjectId for API calls
      label: addr.label || 'Home',
      firstName: addr.firstName || firstName,
      lastName: addr.lastName || lastName,
      email: addr.email || '',
      phone: addr.phone || '',
      address: addr.address || '',
      city: addr.city || '',
      state: addr.state || '',
      zipCode: addr.zipCode || addr.postalCode || '',
      country: addr.country || 'India',
      isDefault: addr.isDefault || false,
      createdAt: addr.createdAt || new Date().toISOString(),
      updatedAt: addr.updatedAt || new Date().toISOString()
    };
  });

  const refreshFromAPI = async () => {
    try {
      const resp = await api.getUserAddresses();
      if (resp && Array.isArray(resp.data)) {
        const apiAddresses = transformApiAddresses(resp.data);
        setAddresses(apiAddresses);
        const def = apiAddresses.find(a => a.isDefault);
        if (def) {
          setDefaultAddressId(def.id);
          await AsyncStorage.setItem('defaultAddressId', def.id);
        }
        await saveAddresses(apiAddresses);
      }
    } catch (e) {
      // ignore
    }
  };

  // Load addresses from storage and API on app start
  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }
    // Throttle frequent loads
    const now = Date.now();
    if (now - lastLoadTimeRef.current < ADDRESSES_LOAD_THROTTLE) {
      return;
    }
    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;
    try {
      setIsLoading(true);
      
      // First try to load from local storage
      const storedAddresses = await AsyncStorage.getItem('userAddresses');
      const storedDefaultId = await AsyncStorage.getItem('defaultAddressId');
      
      if (storedAddresses) {
        setAddresses(JSON.parse(storedAddresses));
      }
      if (storedDefaultId) {
        setDefaultAddressId(storedDefaultId);
      }

      // Then try to fetch from API if user is logged in
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        try {
          const response = await api.getUserAddresses();
          if (response && Array.isArray(response.data)) {
            // Transform API addresses to match our format
            const apiAddresses = transformApiAddresses(response.data);

            // Merge with local addresses, prioritizing API data
            const mergedAddresses = [...apiAddresses];
            const localAddresses = storedAddresses ? JSON.parse(storedAddresses) : [];
            
            // Add local addresses that don't exist in API
            localAddresses.forEach(localAddr => {
              const exists = mergedAddresses.find(apiAddr => apiAddr.id === localAddr.id);
              if (!exists) {
                mergedAddresses.push(localAddr);
              }
            });

            setAddresses(mergedAddresses);
            
            // Set default address
            const defaultAddr = mergedAddresses.find(addr => addr.isDefault);
            if (defaultAddr) {
              setDefaultAddressId(defaultAddr.id);
              await AsyncStorage.setItem('defaultAddressId', defaultAddr.id);
            }
            
            // Save only API addresses to local storage (to preserve _originalId)
            const apiOnlyAddresses = mergedAddresses.filter(addr => addr._originalId);
            if (apiOnlyAddresses.length > 0) {
              await saveAddresses(apiOnlyAddresses);
            }
          }
        } catch (apiError) {
          console.log('API address fetch failed, using local addresses:', apiError);
          
          // If API fails and no local addresses, try to create from user data
          if (!storedAddresses || JSON.parse(storedAddresses).length === 0) {
            try {
              const userData = await AsyncStorage.getItem('userData');
              if (userData) {
                const user = JSON.parse(userData);
                if (user.address || user.city || user.state) {
                  // Create address from user registration data
                  const userAddress = {
                    id: 'user-registration-address',
                    label: 'Home',
                    firstName: user.firstName || user.name?.split(' ')[0] || '',
                    lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    address: user.address || '',
                    city: user.city || '',
                    state: user.state || '',
                    zipCode: user.zipCode || user.postalCode || '',
                    country: user.country || 'India',
                    isDefault: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  
                  setAddresses([userAddress]);
                  setDefaultAddressId(userAddress.id);
                  await AsyncStorage.setItem('defaultAddressId', userAddress.id);
                  await saveAddresses([userAddress]);
                }
              }
            } catch (userDataError) {
              console.log('Failed to create address from user data:', userDataError);
            }
          }
        }
      }
    } catch (error) {
      console.log('Error loading addresses:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
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
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        try {
          // Send only fields; backend will assign _id and default as needed
          await api.addUserAddress({
            label: address.label,
            firstName: address.firstName,
            lastName: address.lastName,
            email: address.email,
            phone: address.phone,
            address: address.address,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country || 'India',
            isDefault: !!address.isDefault,
          });
          await refreshFromAPI();
          return null;
        } catch (apiError) {
          console.log('Failed to save address to API:', apiError);
          // Don't create local address when logged in - throw error instead
          throw new Error('Failed to save address. Please try again.');
        }
      }
      // Only create local address when not logged in
      const newAddress = {
        id: Date.now().toString(),
        ...address,
        isDefault: addresses.length === 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const newAddresses = [...addresses, newAddress];
      setAddresses(newAddresses);
      if (newAddress.isDefault) {
        setDefaultAddressId(newAddress.id);
        await AsyncStorage.setItem('defaultAddressId', newAddress.id);
      }
      await saveAddresses(newAddresses);
      return newAddress;
    } catch (error) {
      console.log('Error adding address:', error);
      throw error;
    }
  };

  const updateAddress = async (id, updates) => {
    try {
      const newAddresses = addresses.map(addr => 
        addr.id === id ? { ...addr, ...updates, updatedAt: new Date().toISOString() } : addr
      );
      
      setAddresses(newAddresses);
      await saveAddresses(newAddresses);

      // Try to update in API if user is logged in
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        try {
          // Find the address to get the correct ID for API call
          const address = addresses.find(addr => addr.id === id);
          
          // Check if this address has an _originalId (meaning it came from the API)
          if (!address || !address._originalId) {
            console.log('Cannot update local address in API. Address will remain local only.');
            return; // Don't throw error, just skip API update
          }
          
          // Use the original MongoDB ObjectId for the API call
          await api.updateUserAddress(address._originalId, updates);
          await refreshFromAPI();
        } catch (apiError) {
          console.log('Failed to update address in API:', apiError);
        }
      }
    } catch (error) {
      console.log('Error updating address:', error);
      throw error;
    }
  };

  const deleteAddress = async (id) => {
    try {
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

      // Try to delete from API if user is logged in
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        try {
          // Find the address to get the correct ID for API call
          const address = addresses.find(addr => addr.id === id);
          
          // Check if this address has an _originalId (meaning it came from the API)
          if (!address || !address._originalId) {
            console.log('Cannot delete local address from API. Address will remain in local storage only.');
            return; // Don't throw error, just skip API delete
          }
          
          // Use the original MongoDB ObjectId for the API call
          await api.deleteUserAddress(address._originalId);
          await refreshFromAPI();
        } catch (apiError) {
          console.log('Failed to delete address from API:', apiError);
        }
      }
    } catch (error) {
      console.log('Error deleting address:', error);
      throw error;
    }
  };

  const setDefaultAddress = async (id) => {
    try {
      // Find the address to get the correct ID for API call
      const address = addresses.find(addr => addr.id === id);
      
      // Check if this address has an _originalId (meaning it came from the API)
      if (!address || !address._originalId) {
        // This is a local address that doesn't exist in the API
        throw new Error('Cannot set local address as default. Please sync with server first.');
      }

      // Try to update in API first if user is logged in
      const token = await AsyncStorage.getItem('authToken');
      
      if (token) {
        try {
          // Use the original MongoDB ObjectId for the API call
          await api.setDefaultUserAddress(address._originalId);
          
          // If API call succeeds, update local state
          const newAddresses = addresses.map(addr => ({
            ...addr,
            isDefault: addr.id === id
          }));
          
          setAddresses(newAddresses);
          setDefaultAddressId(id);
          await AsyncStorage.setItem('defaultAddressId', id);
          await saveAddresses(newAddresses);
          
          // Refresh from API to ensure consistency
          await refreshFromAPI();
          
        } catch (apiError) {
          console.log('Failed to set default address in API:', apiError);
          throw new Error('Failed to set default address. Please try again.');
        }
      } else {
        // No token, just update local state
        const newAddresses = addresses.map(addr => ({
          ...addr,
          isDefault: addr.id === id
        }));
        
        setAddresses(newAddresses);
        setDefaultAddressId(id);
        await AsyncStorage.setItem('defaultAddressId', id);
        await saveAddresses(newAddresses);
      }
    } catch (error) {
      console.log('Error setting default address:', error);
      throw error;
    }
  };

  const getDefaultAddress = () => {
    return addresses.find(addr => addr.isDefault) || addresses[0];
  };

  const getAddressById = (id) => {
    return addresses.find(addr => addr.id === id);
  };

  const refreshAddresses = () => {
    return loadAddresses();
  };

  const forceRefreshFromAPI = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const response = await api.getUserAddresses();
      if (response && Array.isArray(response.data)) {
        const apiAddresses = transformApiAddresses(response.data);
        setAddresses(apiAddresses);
        
        // Set default address
        const defaultAddr = apiAddresses.find(addr => addr.isDefault);
        if (defaultAddr) {
          setDefaultAddressId(defaultAddr.id);
          await AsyncStorage.setItem('defaultAddressId', defaultAddr.id);
        }
        
        // Save API addresses to local storage
        await saveAddresses(apiAddresses);
        
        return apiAddresses;
      }
    } catch (error) {
      console.log('Error forcing refresh from API:', error);
      throw error;
    }
  };

  const syncLocalAddresses = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      // Get local addresses that don't have _originalId (meaning they're local-only)
      const localAddresses = addresses.filter(addr => !addr._originalId);
      
      for (const localAddr of localAddresses) {
        try {
          // Try to add each local address to the server
          await api.addUserAddress({
            label: localAddr.label,
            firstName: localAddr.firstName,
            lastName: localAddr.lastName,
            email: localAddr.email,
            phone: localAddr.phone,
            address: localAddr.address,
            city: localAddr.city,
            state: localAddr.state,
            zipCode: localAddr.zipCode,
            country: localAddr.country,
            isDefault: localAddr.isDefault,
          });
        } catch (apiError) {
          console.log('Failed to sync local address:', apiError);
        }
      }
      
      // Refresh from API to get the updated addresses with proper IDs
      await refreshFromAPI();
    } catch (error) {
      console.log('Error syncing local addresses:', error);
    }
  };

  const value = {
    addresses,
    defaultAddressId,
    isLoading,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress,
    getAddressById,
    loadAddresses,
    refreshAddresses,
    syncLocalAddresses,
    forceRefreshFromAPI,
  };

  return (
    <AddressContext.Provider value={value}>
      {children}
    </AddressContext.Provider>
  );
};