import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Customers.css';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';
import MapPicker from '../MapPicker';
import { geocodeAddress, searchAddressSuggestions } from '../../utils/locationUtils';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [editingAddressData, setEditingAddressData] = useState(null);
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const [newAddressData, setNewAddressData] = useState({
    label: 'Home',
    name: '',
    phone: '',
    address: '', // Floor, house number
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    isDefault: false,
    latitude: null,
    longitude: null,
    road: '',
    locality: '',
    area: '',
    fullAddress: '',
    deliveryLocation: '' // Display location from map
  });
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState(null); // 'new' or 'edit'
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summaryByUser, setSummaryByUser] = useState({}); // { [userId]: { totalOrders, totalSpent } }
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  
  const { register, handleSubmit, watch, reset } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage, statusFilter, appliedSearchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (appliedSearchTerm) params.append('q', appliedSearchTerm);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));

      const url = new URL(`${API_BASE}/api/v1/users?${params.toString()}`);
      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to load customers');
      }

      const list = Array.isArray(json?.data) ? json.data : [];
      const total = json?.meta?.total || 0;
      
      // Map backend users to UI fields
      const mapped = list.map(u => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '-',
        avatar: u.avatar,
        status: u.isActive === false ? 'inactive' : 'active',
        totalOrders: u.totalOrders || 0,
        totalSpent: u.totalSpent || 0,
        createdAt: u.createdAt || new Date().toISOString(),
        lastLogin: u.updatedAt || u.createdAt || new Date().toISOString(),
        address: u.address || '-'
      }));

      setCustomers(mapped);
      // Prefetch summaries for current page customers (best-effort)
      try {
        const token = localStorage.getItem('adminToken');
        const next = { ...summaryByUser };
        await Promise.all(mapped.map(async (u) => {
          if (next[u.id]) return;
          const res2 = await fetch(`${API_BASE}/api/v1/orders/summary?userId=${u.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
          const j2 = await res2.json().catch(() => ({}));
          if (res2.ok && j2?.success) {
            next[u.id] = { totalOrders: j2.data.totalOrders || 0, totalSpent: j2.data.totalSpent || 0 };
          }
        }));
        setSummaryByUser(next);
      } catch (_) {}
      setTotalCount(total);
      setOrders([]);
      setVendors([]);
      setProducts([]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load customers data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (customerId, newStatus) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/v1/users/${customerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: newStatus === 'active' })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update status');
      }
      
      // Refresh the data after status change
      await fetchData();
      
      toast.success(`Customer ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      toast.error('Failed to update customer status');
    }
  };

  const viewCustomerDetails = (customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditFormData({
      id: customer.id,
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone === '-' ? '' : (customer.phone || ''),
      password: ''
    });
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveCustomer = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone
      };

      // Only include password if it's provided and not empty
      if (editFormData.password && editFormData.password.trim() !== '') {
        updateData.password = editFormData.password;
      }

      const res = await fetch(`${API_BASE}/api/v1/users/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update customer');
      }

      toast.success('Customer updated successfully');
      setShowEditModal(false);
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to update customer');
      console.error(error);
    }
  };

  const startEditingAddress = (address, index) => {
    setEditingAddressIndex(index);
    
    // Build location text - prioritize deliveryLocation if it exists
    const buildLocationText = (addr) => {
      // First check if deliveryLocation exists (from previous save)
      if (addr.deliveryLocation && addr.deliveryLocation.trim()) {
        return addr.deliveryLocation;
      }
      
      // Then check fullAddress
      if (addr.fullAddress && addr.fullAddress.trim()) {
        return addr.fullAddress;
      }
      
      // Then check address field
      if (addr.address && addr.address.trim()) {
        return addr.address;
      }
      
      // Build from parts
      const parts = [addr.road, addr.locality, addr.area, addr.city].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
      
      // Fallback
      return [addr.area, addr.city].filter(Boolean).join(', ') || 'Location selected';
    };
    
    const locationText = buildLocationText(address);
    
    setEditingAddressData({ 
      ...address,
      latitude: address.latitude || address.location?.coordinates?.[1] || null,
      longitude: address.longitude || address.location?.coordinates?.[0] || null,
      deliveryLocation: locationText
    });
  };

  const cancelEditingAddress = () => {
    setEditingAddressIndex(null);
    setEditingAddressData(null);
  };

  const handleEditingAddressChange = (field, value) => {
    setEditingAddressData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveAddress = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      // Build address data with location
      const addressPayload = {
        label: editingAddressData.label,
        name: editingAddressData.name,
        firstName: editingAddressData.firstName || editingAddressData.name?.split(' ')[0] || '',
        lastName: editingAddressData.lastName || editingAddressData.name?.split(' ').slice(1).join(' ') || '',
        address: editingAddressData.address || '', // Floor, house number
        road: editingAddressData.road || '',
        locality: editingAddressData.locality || '',
        area: editingAddressData.area || '',
        city: editingAddressData.city || '',
        state: editingAddressData.state || '',
        zipCode: editingAddressData.zipCode || '',
        country: editingAddressData.country || 'India',
        phone: editingAddressData.phone || '',
        isDefault: editingAddressData.isDefault || false,
        fullAddress: editingAddressData.fullAddress || editingAddressData.deliveryLocation || '',
        deliveryLocation: editingAddressData.deliveryLocation || editingAddressData.fullAddress || ''
      };

      // Add location if available
      if (editingAddressData.latitude && editingAddressData.longitude) {
        addressPayload.latitude = editingAddressData.latitude;
        addressPayload.longitude = editingAddressData.longitude;
        addressPayload.location = {
          type: 'Point',
          coordinates: [editingAddressData.longitude, editingAddressData.latitude]
        };
      }

      const res = await fetch(`${API_BASE}/api/v1/users/${selectedCustomer.id}/addresses/${editingAddressData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(addressPayload)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update address');
      }

      // Use the updated addresses list from API response to ensure all isDefault flags are correct
      if (json.data && Array.isArray(json.data)) {
        // Ensure deliveryLocation is preserved in the updated addresses
        const updatedAddresses = json.data.map(addr => {
          if (addr._id === editingAddressData._id) {
            // Preserve deliveryLocation from the data we just saved
            return {
              ...addr,
              deliveryLocation: editingAddressData.deliveryLocation || addr.deliveryLocation || addr.fullAddress || addr.address || ''
            };
          }
          return addr;
        });
        setCustomerAddresses(updatedAddresses);
      } else {
        // Fallback: manually update if API doesn't return full list
        setCustomerAddresses(prev => prev.map((addr, i) => {
          if (i === editingAddressIndex) {
            return {
              ...editingAddressData,
              deliveryLocation: editingAddressData.deliveryLocation || addr.deliveryLocation || ''
            };
          }
          // If current address is being set as default, unset others
          if (editingAddressData.isDefault && addr.isDefault && addr._id !== editingAddressData._id) {
            return { ...addr, isDefault: false };
          }
          return addr;
        }));
      }
      
      toast.success('Address updated successfully');
      setEditingAddressIndex(null);
      setEditingAddressData(null);
    } catch (error) {
      toast.error(error.message || 'Failed to update address');
      console.error(error);
    }
  };

  const handleMapLocationSelect = (locationData) => {
    const { latitude, longitude, addressDetails } = locationData;
    
    // Build location text from address details
    const buildLocationText = (addr) => {
      if (!addr) return 'Location selected';
      
      // Try fullAddress first
      if (addr.fullAddress && addr.fullAddress.trim()) {
        return addr.fullAddress;
      }
      
      // Try display
      if (addr.display && addr.display.trim()) {
        return addr.display;
      }
      
      // Build from parts
      const parts = [addr.road, addr.locality, addr.area, addr.city].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
      
      // Fallback
      return [addr.area, addr.city].filter(Boolean).join(', ') || 'Location selected';
    };
    
    const locationText = buildLocationText(addressDetails);
    
    if (mapPickerMode === 'new') {
      setNewAddressData(prev => ({
        ...prev,
        latitude,
        longitude,
        road: addressDetails?.road || '',
        locality: addressDetails?.locality || '',
        area: addressDetails?.area || '',
        city: addressDetails?.city || '',
        state: addressDetails?.state || '',
        zipCode: addressDetails?.postalCode || '',
        country: addressDetails?.country || 'India',
        fullAddress: addressDetails?.fullAddress || addressDetails?.display || '',
        deliveryLocation: locationText
      }));
    } else if (mapPickerMode === 'edit') {
      setEditingAddressData(prev => ({
        ...prev,
        latitude,
        longitude,
        road: addressDetails?.road || '',
        locality: addressDetails?.locality || '',
        area: addressDetails?.area || '',
        city: addressDetails?.city || '',
        state: addressDetails?.state || '',
        zipCode: addressDetails?.postalCode || '',
        country: addressDetails?.country || 'India',
        fullAddress: addressDetails?.fullAddress || addressDetails?.display || '',
        deliveryLocation: locationText
      }));
    }
    
    setShowMapPicker(false);
    setMapPickerMode(null);
  };

  const startAddingAddress = () => {
    setAddingNewAddress(true);
    setAddressSearchQuery('');
    setNewAddressData({
      label: 'Home',
      name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
      isDefault: false,
      latitude: null,
      longitude: null,
      road: '',
      locality: '',
      area: '',
      fullAddress: '',
      deliveryLocation: ''
    });
  };

  const cancelAddingAddress = () => {
    setAddingNewAddress(false);
    setAddressSearchQuery('');
    setNewAddressData({
      label: 'Home',
      name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
      isDefault: false,
      latitude: null,
      longitude: null,
      road: '',
      locality: '',
      area: '',
      fullAddress: '',
      deliveryLocation: ''
    });
  };

  // Search address suggestions as user types
  useEffect(() => {
    if (!addressSearchQuery.trim() || addressSearchQuery.trim().length < 2) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        setSearchingAddress(true);
        const suggestions = await searchAddressSuggestions(addressSearchQuery);
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch (error) {
        console.error('Error searching addresses:', error);
        setAddressSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearchingAddress(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(searchTimeout);
  }, [addressSearchQuery]);

  const handleAddressSuggestionSelect = async (suggestion) => {
    setAddressSearchQuery(suggestion.display_name);
    setShowSuggestions(false);
    setAddressSuggestions([]);
    
    if (addingNewAddress) {
      setNewAddressData(prev => ({
        ...prev,
        latitude: suggestion.lat,
        longitude: suggestion.lon,
        deliveryLocation: suggestion.display_name
      }));
      // Open map picker with this location
      setMapPickerMode('new');
      setShowMapPicker(true);
    } else if (editingAddressIndex !== null) {
      setEditingAddressData(prev => ({
        ...prev,
        latitude: suggestion.lat,
        longitude: suggestion.lon,
        deliveryLocation: suggestion.display_name
      }));
      // Open map picker with this location
      setMapPickerMode('edit');
      setShowMapPicker(true);
    }
  };

  const handleAddressSearch = async () => {
    if (!addressSearchQuery.trim()) return;
    
    try {
      const location = await geocodeAddress(addressSearchQuery);
      if (location) {
        if (addingNewAddress) {
          setNewAddressData(prev => ({
            ...prev,
            latitude: location.latitude,
            longitude: location.longitude,
            deliveryLocation: addressSearchQuery
          }));
          // Open map picker with this location
          setMapPickerMode('new');
          setShowMapPicker(true);
        } else if (editingAddressIndex !== null) {
          setEditingAddressData(prev => ({
            ...prev,
            latitude: location.latitude,
            longitude: location.longitude,
            deliveryLocation: addressSearchQuery
          }));
          // Open map picker with this location
          setMapPickerMode('edit');
          setShowMapPicker(true);
        }
      } else {
        toast.error('Location not found. Please try a different search term.');
      }
    } catch (error) {
      toast.error('Failed to search location');
    }
  };

  const handleNewAddressChange = (field, value) => {
    setNewAddressData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addNewAddress = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      if (!newAddressData.label || !['Home', 'Work', 'Other'].includes(newAddressData.label)) {
        toast.error('Please select an address label (Home, Work, or Other)');
        return;
      }

      if (!newAddressData.name || !newAddressData.name.trim()) {
        toast.error('Receiver name is required');
        return;
      }

      if (!newAddressData.phone || newAddressData.phone.length !== 10) {
        toast.error('Please enter a valid 10-digit phone number');
        return;
      }

      if (!newAddressData.address || !newAddressData.address.trim()) {
        toast.error('Please enter floor and house number');
        return;
      }

      if (!newAddressData.latitude || !newAddressData.longitude) {
        toast.error('Please select a location on the map');
        return;
      }

      // Build address data with location
      const addressPayload = {
        label: newAddressData.label,
        name: newAddressData.name,
        firstName: newAddressData.name.split(' ')[0] || newAddressData.name,
        lastName: newAddressData.name.split(' ').slice(1).join(' ') || '',
        address: newAddressData.address || '', // Floor, house number
        road: newAddressData.road || '',
        locality: newAddressData.locality || '',
        area: newAddressData.area || '',
        city: newAddressData.city || '',
        state: newAddressData.state || '',
        zipCode: newAddressData.zipCode || '',
        country: newAddressData.country || 'India',
        phone: newAddressData.phone || '',
        isDefault: newAddressData.isDefault || false,
        fullAddress: newAddressData.fullAddress || newAddressData.deliveryLocation || '',
        deliveryLocation: newAddressData.deliveryLocation || newAddressData.fullAddress || ''
      };

      // Add location if available
      if (newAddressData.latitude && newAddressData.longitude) {
        addressPayload.latitude = newAddressData.latitude;
        addressPayload.longitude = newAddressData.longitude;
        addressPayload.location = {
          type: 'Point',
          coordinates: [newAddressData.longitude, newAddressData.latitude]
        };
      }

      const res = await fetch(`${API_BASE}/api/v1/users/${selectedCustomer.id}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(addressPayload)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to add address');
      }

      // Update the addresses list - ensure deliveryLocation is preserved for all addresses
      const updatedAddresses = (json.data || []).map(addr => {
        // Build deliveryLocation if it doesn't exist
        const buildDeliveryLocation = (a) => {
          if (a.deliveryLocation && a.deliveryLocation.trim()) {
            return a.deliveryLocation;
          }
          if (a.fullAddress && a.fullAddress.trim()) {
            return a.fullAddress;
          }
          if (a.address && a.address.trim()) {
            return a.address;
          }
          const parts = [a.road, a.locality, a.area, a.city].filter(Boolean);
          if (parts.length > 0) {
            return parts.join(', ');
          }
          return [a.area, a.city].filter(Boolean).join(', ') || '';
        };
        
        // For the newly added address, use the deliveryLocation we just saved
        // Try to match by coordinates first, then by label+name combination
        const isNewAddress = (newAddressData.latitude && newAddressData.longitude &&
                              addr.latitude === newAddressData.latitude && 
                              addr.longitude === newAddressData.longitude) ||
                             (addr.label === newAddressData.label && 
                              addr.name === newAddressData.name &&
                              !addr.deliveryLocation);
        
        if (isNewAddress && newAddressData.deliveryLocation) {
          return {
            ...addr,
            deliveryLocation: newAddressData.deliveryLocation
          };
        }
        
        // For existing addresses, ensure deliveryLocation exists
        if (!addr.deliveryLocation) {
          return {
            ...addr,
            deliveryLocation: buildDeliveryLocation(addr)
          };
        }
        
        return addr;
      });
      setCustomerAddresses(updatedAddresses);
      
      toast.success('Address added successfully');
      setAddingNewAddress(false);
      setNewAddressData({
        label: '',
        name: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        phone: '',
        isDefault: false,
        latitude: null,
        longitude: null,
        road: '',
        locality: '',
        area: '',
        fullAddress: ''
      });
    } catch (error) {
      toast.error(error.message || 'Failed to add address');
      console.error(error);
    }
  };

  const viewOrderHistory = async (customer) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      const params = new URLSearchParams({ page: '1', limit: '50', userId: customer.id });
      const res = await fetch(`${API_BASE}/api/v1/orders?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch orders');
      const list = Array.isArray(json?.data) ? json.data : [];
      setCustomerOrders(list);
      // Fetch and update summary live for accuracy
      try {
        const sumRes = await fetch(`${API_BASE}/api/v1/orders/summary?userId=${customer.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const sumJson = await sumRes.json().catch(() => ({}));
        if (sumRes.ok && sumJson?.success) {
          setSummaryByUser(prev => ({ ...prev, [customer.id]: { totalOrders: sumJson.data.totalOrders || 0, totalSpent: sumJson.data.totalSpent || 0 } }));
        }
      } catch (_) {}
      setSelectedCustomer(customer);
      setShowOrderModal(true);
    } catch (error) {
      toast.error(error.message || 'Failed to load order history');
    }
  };

  const viewAddresses = async (customer) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      
      const res = await fetch(`${API_BASE}/api/v1/users/${customer.id}/addresses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to load addresses');
      }
      
      setCustomerAddresses(Array.isArray(json?.data) ? json.data : []);
      setSelectedCustomer(customer);
      setShowAddressModal(true);
    } catch (error) {
      toast.error('Failed to load addresses');
    }
  };

  const deleteAddress = async (customerId, addressId) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/v1/users/${customerId}/addresses/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to delete address');
      }

      // Update the addresses list
      setCustomerAddresses(prev => prev.filter(addr => addr._id !== addressId));
      toast.success('Address deleted successfully');
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const deleteCustomer = async (customerId, customerName) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/v1/users/${customerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to delete customer');
      }

      // Refresh the data after deletion
      await fetchData();
      setCustomerToDelete(null);
      toast.success(`Customer "${customerName}" deleted successfully`);
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.companyName : 'Unknown Vendor';
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const currentCustomers = customers; // Customers are already paginated by API

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (loading) {
    return <div className="loading">Loading customers...</div>;
  }

  return (
    <div className="customers">
      <div className="page-header">
        <h2>Customer Management</h2>
        <p>Manage your customer accounts and view their information</p>
      </div>

      {/* Search and Filter */}
      <div className="search-filter">
        <div className="form-group">
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="form-group">
          <select 
            className="form-control" 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { setAppliedSearchTerm(searchTerm); setCurrentPage(1); }}
        >
          Search
        </button>
        {(searchTerm || statusFilter) && (
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setSearchTerm('');
              setAppliedSearchTerm('');
              setStatusFilter('');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Customers</h3>
          <p>{totalCount}</p>
        </div>
        <div className="stat-card">
          <h3>Showing</h3>
          <p>{customers.length} of {totalCount}</p>
        </div>
        {appliedSearchTerm && (
          <div className="stat-card">
            <h3>Search Results</h3>
            <p>Showing filtered results for: "{appliedSearchTerm}"</p>
          </div>
        )}
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentCustomers.map(customer => (
                <tr key={customer.id}>
                  <td>
                    <div className="customer-info">
                      <div className="customer-avatar">
                        {customer.avatar ? (
                          <img 
                            src={customer.avatar} 
                            alt={customer.name}
                            className="avatar-img"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                        ) : null}
                        {!customer.avatar && (
                          <div className="avatar-placeholder">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="customer-details">
                        <strong>{customer.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>
                    <span className={`badge badge-${customer.status === 'active' ? 'success' : 'secondary'}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td>{(summaryByUser[customer.id]?.totalOrders ?? customer.totalOrders) || 0}</td>
                  <td>{formatCurrency(Number((summaryByUser[customer.id]?.totalSpent ?? customer.totalSpent) || 0))}</td>
                  <td>{formatDate(customer.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => viewCustomerDetails(customer)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => viewOrderHistory(customer)}
                      >
                        Orders
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => viewAddresses(customer)}
                      >
                        Addresses
                      </button>
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => openEditModal(customer)}
                      >
                        Edit
                      </button>
                      <div className="toggle-switch-container">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={customer.status === 'active'}
                            onChange={(e) => handleStatusChange(customer.id, e.target.checked ? 'active' : 'inactive')}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span className="toggle-label">{customer.status === 'active' ? 'Active' : 'Inactive'}</span>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          setCustomerToDelete(customer);
                          setShowDeleteModal(true);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination (API-based) */}
        <div className="pagination">
          <button 
            onClick={() => { setCurrentPage(1); }}  
            disabled={currentPage === 1} 
            className="btn btn-secondary"
          >
            First
          </button>
          <button 
            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); }}  
            disabled={currentPage === 1} 
            className="btn btn-secondary"
          >
            Prev
          </button>
          <span className="page-info">Page {currentPage} of {totalPages}</span>
          <button 
            onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); }}  
            disabled={currentPage >= totalPages} 
            className="btn btn-secondary"
          >
            Next
          </button>
          <button 
            onClick={() => { setCurrentPage(totalPages); }}  
            disabled={currentPage >= totalPages} 
            className="btn btn-secondary"
          >
            Last
          </button>
          <select 
            value={itemsPerPage} 
            onChange={(e) => { 
              const newLimit = Number(e.target.value) || 10;
              setItemsPerPage(newLimit);
              setCurrentPage(1);
            }} 
            className="page-size-select" 
            style={{ marginLeft: 8 }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Customer Details Modal */}
      {showModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Customer Details</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="customer-details">
                <div className="detail-row">
                  <strong>Name:</strong> {selectedCustomer.name}
                </div>
                <div className="detail-row">
                  <strong>Email:</strong> {selectedCustomer.email}
                </div>
                <div className="detail-row">
                  <strong>Phone:</strong> {selectedCustomer.phone || '-'}
                </div>
                <div className="detail-row">
                  <strong>Status:</strong> 
                  <span className={`badge badge-${selectedCustomer.status === 'active' ? 'success' : 'secondary'}`}>
                    {selectedCustomer.status}
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Total Orders:</strong> {Number(selectedCustomer.totalOrders || 0)}
                </div>
                <div className="detail-row">
                  <strong>Total Spent:</strong> {formatCurrency(Number(selectedCustomer.totalSpent || 0))}
                </div>
                <div className="detail-row">
                  <strong>Joined:</strong> {selectedCustomer.createdAt ? formatDate(selectedCustomer.createdAt) : '-'}
                </div>
                <div className="detail-row">
                  <strong>Last Login:</strong> {selectedCustomer.lastLogin ? formatDate(selectedCustomer.lastLogin) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order History Modal */}
      {showOrderModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Order History - {selectedCustomer.name}</h3>
              <button className="modal-close" onClick={() => setShowOrderModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {customerOrders.length > 0 ? (
                <div className="order-history">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.map(order => (
                        <tr key={order._id || order.id}>
                          <td>{order.orderNumber || (order._id || '').slice(-6)}</td>
                          <td>{order.createdAt ? formatDateTime(order.createdAt) : '-'}</td>
                          <td>
                            <span className={`badge badge-${String(order.status).toLowerCase().includes('deliver') ? 'success' : String(order.status).toLowerCase().includes('ship') ? 'info' : 'warning'}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>{formatCurrency(Number(order.total || 0))}</td>
                          <td>
                            {(order.items || []).slice(0, 3).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || getProductName(item.product) || 'Item'}</span>
                                <span>x{item.quantity}</span>
                                <span>{formatCurrency(Number(item.price || 0))}</span>
                              </div>
                            ))}
                            {(order.items || []).length > 3 && (
                              <div style={{ color: '#666', fontSize: 12 }}>+ {(order.items || []).length - 3} more</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No orders found for this customer.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Addresses Modal */}
      {showAddressModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowAddressModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Addresses - {selectedCustomer.name}</h3>
              <button className="modal-close" onClick={() => {
                setShowAddressModal(false);
                setAddingNewAddress(false);
                setEditingAddressIndex(null);
              }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="address-modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={startAddingAddress}
                  disabled={addingNewAddress || editingAddressIndex !== null}
                >
                  + Add New Address
                </button>
              </div>

              {addingNewAddress && (
                <div className="address-item">
                  <div className="address-edit-form" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Add New Address</h4>
                    
                    {/* Search Bar */}
                    <div className="form-group" style={{ marginBottom: '20px', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            type="text"
                            className="form-control"
                            style={{ width: '100%', paddingRight: '40px' }}
                            value={addressSearchQuery}
                            onChange={(e) => {
                              setAddressSearchQuery(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onFocus={() => {
                              if (addressSuggestions.length > 0) {
                                setShowSuggestions(true);
                              }
                            }}
                            onBlur={() => {
                              // Delay to allow click on suggestion
                              setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                            placeholder="Search for area, street name..."
                          />
                          {searchingAddress && (
                            <span style={{ 
                              position: 'absolute', 
                              right: '12px', 
                              top: '50%', 
                              transform: 'translateY(-50%)',
                              fontSize: '14px'
                            }}>⏳</span>
                          )}
                          
                          {/* Suggestions Dropdown */}
                          {showSuggestions && addressSuggestions.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              backgroundColor: '#fff',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              zIndex: 1000,
                              maxHeight: '300px',
                              overflowY: 'auto',
                              marginTop: '4px'
                            }}>
                              {addressSuggestions.map((suggestion, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    padding: '12px',
                                    cursor: 'pointer',
                                    borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none'
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleAddressSuggestionSelect(suggestion);
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#f8f9fa';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = '#fff';
                                  }}
                                >
                                  <div style={{ fontSize: '14px', color: '#333', fontWeight: '500' }}>
                                    {suggestion.display_name}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-info"
                          onClick={() => {
                            setMapPickerMode('new');
                            setShowMapPicker(true);
                          }}
                          title="Select location on map"
                        >
                          🗺️ Map
                        </button>
                      </div>
                    </div>

                    {/* Delivery Details */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label style={{ marginBottom: '8px', fontWeight: '500' }}>Delivery details</label>
                      <div 
                        className="form-control" 
                        style={{ 
                          padding: '12px', 
                          backgroundColor: '#f8f9fa', 
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                        onClick={() => {
                          setMapPickerMode('new');
                          setShowMapPicker(true);
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>📍</span>
                        <span style={{ flex: 1, color: newAddressData.deliveryLocation ? '#333' : '#999' }}>
                          {newAddressData.deliveryLocation || 'Tap to select location on map'}
                        </span>
                        <span>→</span>
                      </div>
                    </div>

                    {/* Address Details */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label style={{ marginBottom: '8px', fontWeight: '500' }}>Address details *</label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ 
                          padding: '12px',
                          border: '2px solid #f7ab18',
                          borderRadius: '8px'
                        }}
                        value={newAddressData.address}
                        onChange={(e) => handleNewAddressChange('address', e.target.value)}
                        placeholder="E.g. Floor, House no."
                      />
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        Please enter floor and house number
                      </small>
                    </div>

                    {/* Receiver Details */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label style={{ marginBottom: '8px', fontWeight: '500' }}>Receiver details for this address</label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ marginBottom: '12px', padding: '12px', borderRadius: '8px' }}
                        value={newAddressData.name}
                        onChange={(e) => handleNewAddressChange('name', e.target.value)}
                        placeholder="Receiver Name"
                      />
                      <input
                        type="text"
                        className="form-control"
                        style={{ padding: '12px', borderRadius: '8px' }}
                        value={newAddressData.phone}
                        onChange={(e) => {
                          const numericText = e.target.value.replace(/[^0-9]/g, '');
                          handleNewAddressChange('phone', numericText);
                        }}
                        placeholder="Phone Number"
                        maxLength={10}
                      />
                    </div>

                    {/* Save Address As */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label style={{ marginBottom: '12px', fontWeight: '500', display: 'block' }}>Save address as</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {['Home', 'Work', 'Other'].map((label) => (
                          <button
                            key={label}
                            type="button"
                            className="btn"
                            style={{
                              flex: 1,
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              backgroundColor: newAddressData.label === label ? '#d32f2f' : '#fff',
                              color: newAddressData.label === label ? '#fff' : '#666',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontWeight: '500'
                            }}
                            onClick={() => handleNewAddressChange('label', label)}
                          >
                            <span>
                              {label === 'Home' ? '🏠' : label === 'Work' ? '💼' : '📍'}
                            </span>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="address-edit-actions" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={cancelAddingAddress}
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={addNewAddress}
                        style={{ flex: 1 }}
                      >
                        Save Address
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {customerAddresses.length > 0 ? (
                <div className="address-list">
                  {customerAddresses.map((address, index) => (
                    <div key={index} className="address-item">
                      {editingAddressIndex === index ? (
                        <div className="address-edit-form" style={{ maxWidth: '600px', margin: '0 auto' }}>
                          <h4 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Edit Address</h4>
                          
                          {/* Search Bar */}
                          <div className="form-group" style={{ marginBottom: '20px', position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ width: '100%', paddingRight: '40px' }}
                                  value={addressSearchQuery}
                                  onChange={(e) => {
                                    setAddressSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                  }}
                                  onFocus={() => {
                                    if (addressSuggestions.length > 0) {
                                      setShowSuggestions(true);
                                    }
                                  }}
                                  onBlur={() => {
                                    // Delay to allow click on suggestion
                                    setTimeout(() => setShowSuggestions(false), 200);
                                  }}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                                  placeholder="Search for area, street name..."
                                />
                                {searchingAddress && (
                                  <span style={{ 
                                    position: 'absolute', 
                                    right: '12px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)',
                                    fontSize: '14px'
                                  }}>⏳</span>
                                )}
                                
                                {/* Suggestions Dropdown */}
                                {showSuggestions && addressSuggestions.length > 0 && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    backgroundColor: '#fff',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    zIndex: 1000,
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    marginTop: '4px'
                                  }}>
                                    {addressSuggestions.map((suggestion, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          padding: '12px',
                                          cursor: 'pointer',
                                          borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none'
                                        }}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleAddressSuggestionSelect(suggestion);
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.backgroundColor = '#f8f9fa';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.backgroundColor = '#fff';
                                        }}
                                      >
                                        <div style={{ fontSize: '14px', color: '#333', fontWeight: '500' }}>
                                          {suggestion.display_name}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn btn-info"
                                onClick={() => {
                                  setMapPickerMode('edit');
                                  setShowMapPicker(true);
                                }}
                                title="Select location on map"
                              >
                                🗺️ Map
                              </button>
                            </div>
                          </div>

                          {/* Delivery Details */}
                          <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ marginBottom: '8px', fontWeight: '500' }}>Delivery details</label>
                            <div 
                              className="form-control" 
                              style={{ 
                                padding: '12px', 
                                backgroundColor: '#f8f9fa', 
                                border: '1px solid #dee2e6',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                              }}
                              onClick={() => {
                                setMapPickerMode('edit');
                                setShowMapPicker(true);
                              }}
                            >
                              <span style={{ fontSize: '20px' }}>📍</span>
                              <span style={{ flex: 1, color: editingAddressData?.deliveryLocation ? '#333' : '#999' }}>
                                {editingAddressData?.deliveryLocation || 'Tap to select location on map'}
                              </span>
                              <span>→</span>
                            </div>
                          </div>

                          {/* Address Details */}
                          <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ marginBottom: '8px', fontWeight: '500' }}>Address details *</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ 
                                padding: '12px',
                                border: '2px solid #f7ab18',
                                borderRadius: '8px'
                              }}
                              value={editingAddressData?.address || ''}
                              onChange={(e) => handleEditingAddressChange('address', e.target.value)}
                              placeholder="E.g. Floor, House no."
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                              Please enter floor and house number
                            </small>
                          </div>

                          {/* Receiver Details */}
                          <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ marginBottom: '8px', fontWeight: '500' }}>Receiver details for this address</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ marginBottom: '12px', padding: '12px', borderRadius: '8px' }}
                              value={editingAddressData?.name || ''}
                              onChange={(e) => handleEditingAddressChange('name', e.target.value)}
                              placeholder="Receiver Name"
                            />
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '12px', borderRadius: '8px' }}
                              value={editingAddressData?.phone || ''}
                              onChange={(e) => {
                                const numericText = e.target.value.replace(/[^0-9]/g, '');
                                handleEditingAddressChange('phone', numericText);
                              }}
                              placeholder="Phone Number"
                              maxLength={10}
                            />
                          </div>

                          {/* Save Address As */}
                          <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ marginBottom: '12px', fontWeight: '500', display: 'block' }}>Save address as</label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              {['Home', 'Work', 'Other'].map((label) => (
                                <button
                                  key={label}
                                  type="button"
                                  className="btn"
                                  style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #dee2e6',
                                    backgroundColor: editingAddressData?.label === label ? '#d32f2f' : '#fff',
                                    color: editingAddressData?.label === label ? '#fff' : '#666',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontWeight: '500'
                                  }}
                                  onClick={() => handleEditingAddressChange('label', label)}
                                >
                                  <span>
                                    {label === 'Home' ? '🏠' : label === 'Work' ? '💼' : '📍'}
                                  </span>
                                  <span>{label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="address-edit-actions" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={cancelEditingAddress}
                              style={{ flex: 1 }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={saveAddress}
                              style={{ flex: 1 }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="address-header">
                            <strong>{address.label}</strong>
                            <div className="address-actions">
                              {address.isDefault && (
                                <span className="badge badge-success">Default</span>
                              )}
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => startEditingAddress(address, index)}
                                disabled={addingNewAddress}
                                style={{ marginLeft: '10px' }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this address?')) {
                                    deleteAddress(selectedCustomer.id, address._id);
                                  }
                                }}
                                disabled={addingNewAddress}
                                style={{ marginLeft: '10px' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="address-details">
                            <div><strong>{address.name}</strong></div>
                            <div>{address.address}</div>
                            <div>{address.city}, {address.state} {address.zipCode}</div>
                            <div>{address.country}</div>
                            {address.phone && <div>Phone: {address.phone}</div>}
                            {address.location?.coordinates && (
                              <div>Location: {address.location.coordinates[1].toFixed(6)}, {address.location.coordinates[0].toFixed(6)}</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No addresses found for this customer.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Customer - {selectedCustomer.name}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="edit-customer-form">
                <div className="form-section">
                  <h4>Basic Information</h4>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.name || ''}
                      onChange={(e) => handleEditFormChange('name', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editFormData.email || ''}
                      onChange={(e) => handleEditFormChange('email', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.phone || ''}
                      onChange={(e) => handleEditFormChange('phone', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>New Password (leave blank to keep current)</label>
                    <input
                      type="password"
                      className="form-control"
                      value={editFormData.password || ''}
                      onChange={(e) => handleEditFormChange('password', e.target.value)}
                      placeholder="Enter new password (min 8 characters)"
                    />
                    <small style={{ color: '#666', fontSize: '12px' }}>
                      Leave blank if you don't want to change the password
                    </small>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCustomer}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && customerToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Deletion</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete customer "{customerToDelete.name}"? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                deleteCustomer(customerToDelete.id, customerToDelete.name);
                setShowDeleteModal(false);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <MapPicker
          initialLocation={
            mapPickerMode === 'new' 
              ? (newAddressData.latitude && newAddressData.longitude 
                  ? { latitude: newAddressData.latitude, longitude: newAddressData.longitude }
                  : null)
              : (editingAddressData?.latitude && editingAddressData?.longitude
                  ? { latitude: editingAddressData.latitude, longitude: editingAddressData.longitude }
                  : null)
          }
          initialAddress={
            mapPickerMode === 'new'
              ? newAddressData
              : editingAddressData
          }
          onSelectLocation={handleMapLocationSelect}
          onClose={() => {
            setShowMapPicker(false);
            setMapPickerMode(null);
          }}
        />
      )}
    </div>
  );
};

export default Customers; 