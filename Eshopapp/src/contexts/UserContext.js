import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 234 567 8900',
    avatar: 'https://i.pravatar.cc/100',
  });

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

  const updateUser = (userData) => {
    setUser(prevUser => ({ ...prevUser, ...userData }));
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
    orders,
    addresses,
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