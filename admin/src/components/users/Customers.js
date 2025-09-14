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
  const [customerToDelete, setCustomerToDelete] = useState(null);
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
                <th>Contact</th>
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
                        <span>ID: {customer.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="contact-info">
                      <div>{customer.email}</div>
                      <div>{customer.phone}</div>
                    </div>
                  </td>
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
                        className={`btn btn-sm ${customer.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => handleStatusChange(customer.id, customer.status === 'active' ? 'inactive' : 'active')}
                      >
                        {customer.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
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
                  <strong>Address:</strong> {selectedCustomer.address || '-'}
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
              <button className="modal-close" onClick={() => setShowAddressModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {customerAddresses.length > 0 ? (
                <div className="address-list">
                  {customerAddresses.map((address, index) => (
                    <div key={index} className="address-item">
                      <div className="address-header">
                        <strong>{address.label}</strong>
                        <div className="address-actions">
                          {address.isDefault && (
                            <span className="badge badge-success">Default</span>
                          )}
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this address?')) {
                                deleteAddress(selectedCustomer.id, address._id);
                              }
                            }}
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