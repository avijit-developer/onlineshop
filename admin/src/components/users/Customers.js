import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Customers.css';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';

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
    label: '',
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: '',
    isDefault: false
  });
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
      phone: customer.phone === '-' ? '' : (customer.phone || '')
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

      const res = await fetch(`${API_BASE}/api/v1/users/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editFormData.name,
          email: editFormData.email,
          phone: editFormData.phone
        })
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
    setEditingAddressData({ ...address });
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

      const res = await fetch(`${API_BASE}/api/v1/users/${selectedCustomer.id}/addresses/${editingAddressData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingAddressData)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update address');
      }

      // Use the updated addresses list from API response to ensure all isDefault flags are correct
      if (json.data && Array.isArray(json.data)) {
        setCustomerAddresses(json.data);
      } else {
        // Fallback: manually update if API doesn't return full list
        setCustomerAddresses(prev => prev.map((addr, i) => {
          if (i === editingAddressIndex) {
            return editingAddressData;
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

  const startAddingAddress = () => {
    setAddingNewAddress(true);
    setNewAddressData({
      label: '',
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      phone: '',
      isDefault: false
    });
  };

  const cancelAddingAddress = () => {
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
      isDefault: false
    });
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

      if (!newAddressData.label || !newAddressData.address || !newAddressData.name) {
        toast.error('Label, Name, and Address are required');
        return;
      }

      const res = await fetch(`${API_BASE}/api/v1/users/${selectedCustomer.id}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAddressData)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to add address');
      }

      // Update the addresses list
      setCustomerAddresses(json.data || []);
      
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
        isDefault: false
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
                  <div className="address-edit-form">
                    <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Add New Address</h4>
                    <div className="form-group">
                      <label>Label *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddressData.label}
                        onChange={(e) => handleNewAddressChange('label', e.target.value)}
                        placeholder="e.g., Home, Office"
                      />
                    </div>
                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddressData.name}
                        onChange={(e) => handleNewAddressChange('name', e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Address *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddressData.address}
                        onChange={(e) => handleNewAddressChange('address', e.target.value)}
                        placeholder="Street address"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>City</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newAddressData.city}
                          onChange={(e) => handleNewAddressChange('city', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>State</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newAddressData.state}
                          onChange={(e) => handleNewAddressChange('state', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Zip Code</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newAddressData.zipCode}
                          onChange={(e) => handleNewAddressChange('zipCode', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Country</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddressData.country}
                        onChange={(e) => handleNewAddressChange('country', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddressData.phone}
                        onChange={(e) => handleNewAddressChange('phone', e.target.value)}
                      />
                    </div>
                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newAddressData.isDefault}
                          onChange={(e) => handleNewAddressChange('isDefault', e.target.checked)}
                        />
                        Set as default address
                      </label>
                    </div>
                    <div className="address-edit-actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={cancelAddingAddress}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={addNewAddress}
                      >
                        Add Address
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
                        <div className="address-edit-form">
                          <div className="form-group">
                            <label>Label</label>
                            <input
                              type="text"
                              className="form-control"
                              value={editingAddressData?.label || ''}
                              onChange={(e) => handleEditingAddressChange('label', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label>Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={editingAddressData?.name || ''}
                              onChange={(e) => handleEditingAddressChange('name', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label>Address</label>
                            <input
                              type="text"
                              className="form-control"
                              value={editingAddressData?.address || ''}
                              onChange={(e) => handleEditingAddressChange('address', e.target.value)}
                            />
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>City</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editingAddressData?.city || ''}
                                onChange={(e) => handleEditingAddressChange('city', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>State</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editingAddressData?.state || ''}
                                onChange={(e) => handleEditingAddressChange('state', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>Zip Code</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editingAddressData?.zipCode || ''}
                                onChange={(e) => handleEditingAddressChange('zipCode', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Country</label>
                            <input
                              type="text"
                              className="form-control"
                              value={editingAddressData?.country || ''}
                              onChange={(e) => handleEditingAddressChange('country', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label>Phone</label>
                            <input
                              type="text"
                              className="form-control"
                              value={editingAddressData?.phone || ''}
                              onChange={(e) => handleEditingAddressChange('phone', e.target.value)}
                            />
                          </div>
                          <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={editingAddressData?.isDefault || false}
                                onChange={(e) => handleEditingAddressChange('isDefault', e.target.checked)}
                              />
                              Set as default address
                            </label>
                          </div>
                          <div className="address-edit-actions">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={cancelEditingAddress}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={saveAddress}
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
    </div>
  );
};

export default Customers; 