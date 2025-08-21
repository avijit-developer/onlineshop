import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Customers.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  
  const itemsPerPage = 10;
  const { register, handleSubmit, watch, reset } = useForm();
  
  const searchTerm = watch('search', '');
  const statusFilter = watch('status', '');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, statusFilter]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setLoading(false);
        return;
      }
      const url = new URL(`${API_BASE}/api/v1/users`);
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
      // Map backend users to UI fields
      const mapped = list.map(u => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '-',
        status: u.isActive === false ? 'inactive' : 'active',
        totalOrders: u.totalOrders || 0,
        totalSpent: u.totalSpent || 0,
        createdAt: u.createdAt || new Date().toISOString(),
        lastLogin: u.updatedAt || u.createdAt || new Date().toISOString(),
        address: u.address || '-'
      }));
      setCustomers(mapped);
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

  const filterCustomers = () => {
    let filtered = [...customers];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(customer => customer.status === statusFilter);
    }

    setFilteredCustomers(filtered);
    setCurrentPage(1);
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
      
      setCustomers(prev => prev.map(customer =>
        customer.id === customerId ? { ...customer, status: newStatus } : customer
      ));
      
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
      const customerOrders = orders.filter(order => order.customerId === customer.id);
      setCustomerOrders(customerOrders);
      setSelectedCustomer(customer);
      setShowOrderModal(true);
    } catch (error) {
      toast.error('Failed to load order history');
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
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

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
            {...register('search')}
          />
        </div>
        <div className="form-group">
          <select className="form-control" {...register('status')}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => {
            reset();
            setFilteredCustomers(customers);
          }}
        >
          Clear Filters
        </button>
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
                      <strong>{customer.name}</strong>
                      <span>ID: {customer.id}</span>
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
                  <td>{customer.totalOrders}</td>
                  <td>${customer.totalSpent.toLocaleString()}</td>
                  <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
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
                        className={`btn btn-sm ${customer.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => handleStatusChange(customer.id, customer.status === 'active' ? 'inactive' : 'active')}
                      >
                        {customer.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={currentPage === page ? 'active' : ''}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Customer Details Modal */}
      {showModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
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
                  <strong>Phone:</strong> {selectedCustomer.phone}
                </div>
                <div className="detail-row">
                  <strong>Address:</strong> {selectedCustomer.address}
                </div>
                <div className="detail-row">
                  <strong>Status:</strong> 
                  <span className={`badge badge-${selectedCustomer.status === 'active' ? 'success' : 'secondary'}`}>
                    {selectedCustomer.status}
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Total Orders:</strong> {selectedCustomer.totalOrders}
                </div>
                <div className="detail-row">
                  <strong>Total Spent:</strong> ${selectedCustomer.totalSpent.toLocaleString()}
                </div>
                <div className="detail-row">
                  <strong>Joined:</strong> {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                </div>
                <div className="detail-row">
                  <strong>Last Login:</strong> {new Date(selectedCustomer.lastLogin).toLocaleDateString()}
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
                  {customerOrders.map(order => (
                    <div key={order.id} className="order-item">
                      <div className="order-header">
                        <strong>{order.orderNumber}</strong>
                        <span className={`badge badge-${order.status === 'delivered' ? 'success' : order.status === 'shipped' ? 'info' : 'warning'}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="order-details">
                        <div>Date: {new Date(order.createdAt).toLocaleDateString()}</div>
                        <div>Total: ${order.total}</div>
                        <div>Vendor: {getVendorName(order.vendorId)}</div>
                      </div>
                      <div className="order-items">
                        {order.items.map((item, index) => (
                          <div key={index} className="order-item-detail">
                            <span>{getProductName(item.productId)}</span>
                            <span>Qty: {item.quantity}</span>
                            <span>${item.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No orders found for this customer.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers; 