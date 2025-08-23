import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([
    { id: 1, name: 'Express Delivery', phone: '+1234567890' },
    { id: 2, name: 'FastTrack Logistics', phone: '+1234567891' },
    { id: 3, name: 'QuickShip', phone: '+1234567892' }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter, dateFilter]);

  const fetchData = async () => {
    try {
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('adminToken');
      let loadedFromBackend = false;
      try {
        const resp = await fetch(`${baseUrl}/api/v1/orders`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success) {
            setOrders(json.data || []);
            loadedFromBackend = true;
          }
        }
      } catch (_) {}

      if (!loadedFromBackend) {
        try {
          const response = await fetch('/data.json');
          const data = await response.json();
          setOrders(data.orders || []);
          setCustomers(data.users?.filter(user => user.role === 'customer') || []);
          setVendors(data.vendors || []);
        } catch (e) {
          toast.error('Failed to load data');
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      const orderDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(order => {
            orderDate.setTime(new Date(order.createdAt).getTime());
            return orderDate.toDateString() === today.toDateString();
          });
          break;
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(order => new Date(order.createdAt) >= weekAgo);
          break;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(order => new Date(order.createdAt) >= monthAgo);
          break;
        default:
          break;
      }
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const updatedOrders = orders.map(order =>
        order.id === orderId 
          ? { 
              ...order, 
              status: newStatus, 
              updatedAt: new Date().toISOString(),
              statusHistory: [
                ...(order.statusHistory || []),
                {
                  status: newStatus,
                  timestamp: new Date().toISOString(),
                  updatedBy: 'Admin'
                }
              ]
            }
          : order
      );
      setOrders(updatedOrders);
      setShowStatusModal(false);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleViewInvoice = (order) => {
    setSelectedOrder(order);
    setShowInvoiceModal(true);
  };

  const handleAssignDelivery = (order) => {
    setSelectedOrder(order);
    setShowDeliveryModal(true);
  };

  const assignDeliveryPartner = (partnerId) => {
    if (selectedOrder) {
      const partner = deliveryPartners.find(p => p.id === partnerId);
      const updatedOrders = orders.map(order =>
        order.id === selectedOrder.id 
          ? { 
              ...order, 
              deliveryPartner: partner,
              updatedAt: new Date().toISOString()
            }
          : order
      );
      setOrders(updatedOrders);
      setShowDeliveryModal(false);
      toast.success(`Delivery partner assigned: ${partner.name}`);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.companyName : 'Unknown Vendor';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'confirmed':
        return 'status-confirmed';
      case 'processing':
        return 'status-processing';
      case 'shipped':
        return 'status-shipped';
      case 'delivered':
        return 'status-delivered';
      case 'cancelled':
        return 'status-cancelled';
      case 'refunded':
        return 'status-refunded';
      default:
        return 'status-pending';
    }
  };

  const calculateOrderTotal = (order) => {
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = (subtotal * order.tax) / 100;
    const shipping = order.shippingCost || 0;
    return subtotal + tax + shipping;
  };

  const generateInvoice = () => {
    // This would generate a PDF invoice
    // For now, just show a success message
    toast.success('Invoice generated successfully');
    setShowInvoiceModal(false);
  };

  const downloadInvoice = () => {
    // This would download the invoice
    toast.success('Invoice downloaded successfully');
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  if (loading) {
    return <div className="loading">Loading orders...</div>;
  }

  return (
    <div className="orders-container">
      <div className="page-header">
        <h1>Order Management</h1>
        <div className="header-actions">
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Orders</h3>
          <p>{orders.length}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Orders</h3>
          <p>{orders.filter(o => o.status === 'pending').length}</p>
        </div>
        <div className="stat-card">
          <h3>Processing</h3>
          <p>{orders.filter(o => o.status === 'processing').length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>${orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Vendor</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <div className="order-info">
                    <strong>#{order.orderNumber}</strong>
                    <small>{order.paymentMethod}</small>
                  </div>
                </td>
                <td>
                  <div className="customer-info">
                    <strong>{getCustomerName(order.customerId)}</strong>
                    <small>{order.customerEmail}</small>
                  </div>
                </td>
                <td>{getVendorName(order.vendorId)}</td>
                <td>
                  <span className="items-count">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td>
                  <strong>${calculateOrderTotal(order).toFixed(2)}</strong>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    <small>{new Date(order.createdAt).toLocaleTimeString()}</small>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleViewDetails(order)}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleViewInvoice(order)}
                      className="btn btn-info btn-sm"
                    >
                      Invoice
                    </button>
                    <button
                      onClick={() => handleAssignDelivery(order)}
                      className="btn btn-primary btn-sm"
                    >
                      Delivery
                    </button>
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowStatusModal(true);
                      }}
                      className="btn btn-warning btn-sm"
                    >
                      Status
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
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal order-details-modal">
            <div className="modal-header">
              <h2>Order Details - #{selectedOrder.orderNumber}</h2>
              <button onClick={() => setShowDetailsModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="order-details">
                <div className="order-header">
                  <div className="order-status">
                    <span className={`status-badge ${getStatusBadgeClass(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                    <span className="order-date">
                      {new Date(selectedOrder.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="order-sections">
                  <div className="section">
                    <h3>Customer Information</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Name:</label>
                        <span>{getCustomerName(selectedOrder.customerId)}</span>
                      </div>
                      <div className="info-item">
                        <label>Email:</label>
                        <span>{selectedOrder.customerEmail}</span>
                      </div>
                      <div className="info-item">
                        <label>Phone:</label>
                        <span>{selectedOrder.customerPhone}</span>
                      </div>
                      <div className="info-item">
                        <label>Address:</label>
                        <span>{selectedOrder.shippingAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="section">
                    <h3>Order Items</h3>
                    <div className="order-items">
                      {selectedOrder.items.map((item, index) => (
                        <div key={index} className="order-item">
                          <img src={item.image || '/default-product.png'} alt={item.name} />
                          <div className="item-details">
                            <h4>{item.name}</h4>
                            <p>SKU: {item.sku}</p>
                            <p>Quantity: {item.quantity}</p>
                            <p>Price: ${item.price}</p>
                          </div>
                          <div className="item-total">
                            ${(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="section">
                    <h3>Order Summary</h3>
                    <div className="order-summary">
                      <div className="summary-row">
                        <span>Subtotal:</span>
                        <span>${selectedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                      </div>
                      <div className="summary-row">
                        <span>Tax ({selectedOrder.tax}%):</span>
                        <span>${((selectedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * selectedOrder.tax) / 100).toFixed(2)}</span>
                      </div>
                      <div className="summary-row">
                        <span>Shipping:</span>
                        <span>${selectedOrder.shippingCost || 0}</span>
                      </div>
                      <div className="summary-row total">
                        <span>Total:</span>
                        <span>${calculateOrderTotal(selectedOrder).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                    <div className="section">
                      <h3>Status History</h3>
                      <div className="status-history">
                        {selectedOrder.statusHistory.map((history, index) => (
                          <div key={index} className="history-item">
                            <span className="status">{history.status}</span>
                            <span className="date">{new Date(history.timestamp).toLocaleString()}</span>
                            <span className="updated-by">{history.updatedBy}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal invoice-modal">
            <div className="modal-header">
              <h2>Invoice - #{selectedOrder.orderNumber}</h2>
              <button onClick={() => setShowInvoiceModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="invoice-content">
                <div className="invoice-header">
                  <h3>INVOICE</h3>
                  <div className="invoice-details">
                    <p><strong>Invoice #:</strong> INV-{selectedOrder.orderNumber}</p>
                    <p><strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                    <p><strong>Due Date:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="invoice-sections">
                  <div className="invoice-section">
                    <h4>Bill To:</h4>
                    <p>{getCustomerName(selectedOrder.customerId)}</p>
                    <p>{selectedOrder.customerEmail}</p>
                    <p>{selectedOrder.shippingAddress}</p>
                  </div>

                  <div className="invoice-section">
                    <h4>Items:</h4>
                    <table className="invoice-items">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>${item.price}</td>
                            <td>${(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="invoice-summary">
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <span>${selectedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Tax:</span>
                      <span>${((selectedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * selectedOrder.tax) / 100).toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Shipping:</span>
                      <span>${selectedOrder.shippingCost || 0}</span>
                    </div>
                    <div className="summary-row total">
                      <span>Total:</span>
                      <span>${calculateOrderTotal(selectedOrder).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowInvoiceModal(false)} className="btn btn-secondary">
                Close
              </button>
              <button onClick={generateInvoice} className="btn btn-primary">
                Generate PDF
              </button>
              <button onClick={downloadInvoice} className="btn btn-success">
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Update Order Status</h2>
              <button onClick={() => setShowStatusModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="status-update-form">
                <p>Current Status: <span className={`status-badge ${getStatusBadgeClass(selectedOrder.status)}`}>{selectedOrder.status}</span></p>
                <div className="status-options">
                  {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedOrder.id, status)}
                      className={`btn ${status === selectedOrder.status ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={status === selectedOrder.status}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Assignment Modal */}
      {showDeliveryModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Assign Delivery Partner</h2>
              <button onClick={() => setShowDeliveryModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="delivery-partners">
                <p>Select a delivery partner for order #{selectedOrder.orderNumber}:</p>
                {deliveryPartners.map(partner => (
                  <div key={partner.id} className="partner-option">
                    <input
                      type="radio"
                      id={`partner-${partner.id}`}
                      name="deliveryPartner"
                      value={partner.id}
                      onChange={() => assignDeliveryPartner(partner.id)}
                    />
                    <label htmlFor={`partner-${partner.id}`}>
                      <strong>{partner.name}</strong>
                      <span>{partner.phone}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders; 