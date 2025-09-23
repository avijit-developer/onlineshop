import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/currency';
import { toast } from 'react-hot-toast';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Active filters (applied)
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  // Draft filters (edited in UI before Apply)
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftVendor, setDraftVendor] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
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

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('adminUser') || 'null'); } catch { return null; }
  })();
  const isVendor = currentUser?.role === 'vendor';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { Authorization: token ? `Bearer ${token}` : '' };
  };

  // Normalize various backend statuses into a small set
  const normalizeStatus = (s) => {
    const v = String(s || '').toLowerCase();
    if (['cancelled','canceled'].includes(v)) return 'cancelled';
    if (['delivered','completed'].includes(v)) return 'delivered';
    if (['shipped','out_for_delivery','out-for-delivery','dispatched','in_transit'].includes(v)) return 'shipped';
    if (['confirmed'].includes(v)) return 'confirmed';
    if (['processing','packed','pending'].includes(v)) return 'processing';
    return v || 'processing';
  };

  // Aggregate per-vendor statuses into a single display status
  const aggregateMultiVendorStatus = (order) => {
    try {
      const vendorIds = Array.from(new Set((order.items || []).map(i => String(i.vendor)).filter(Boolean)));
      if (vendorIds.length <= 1) return String(order.status || 'pending');
      // Collect vendor-specific statuses if provided; fallback to global
      const vsMap = order.vendorStatuses || {};
      const statuses = vendorIds.map(vid => normalizeStatus(vsMap[vid] || order.status));
      const unique = Array.from(new Set(statuses));
      if (unique.length === 1) return unique[0].charAt(0).toUpperCase() + unique[0].slice(1);
      const precedence = ['cancelled','delivered','shipped','processing','confirmed','pending'];
      for (const st of precedence) {
        if (unique.includes(st)) {
          const label = st.charAt(0).toUpperCase() + st.slice(1);
          return `Partially ${label}`;
        }
      }
      return 'Partially Processing';
    } catch (_) {
      return String(order.status || 'Pending');
    }
  };

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter, dateFrom, dateTo, emailFilter, vendorFilter]);

  const fetchData = async () => {
    try {
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      let loadedFromBackend = false;
      try {
        const ordersEndpoint = isVendor ? `${baseUrl}/api/v1/orders/vendor?page=1&limit=1000` : `${baseUrl}/api/v1/orders`;
        const [resp, venRes] = await Promise.all([
          fetch(ordersEndpoint, { headers: getAuthHeaders() }),
          fetch(`${baseUrl}/api/v1/vendors?page=1&limit=1000`, { headers: getAuthHeaders() }).catch(() => ({ ok: true, json: async () => ({ data: [] }) })),
        ]);
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success) {
            // Vendor API returns mapped objects with id and vendor totals
            setOrders(json.data || []);
            loadedFromBackend = true;
          }
        }
        try {
          const venJson = await venRes.json();
          if (venRes.ok) setVendors((venJson.data || []).map(v => ({ id: v._id || v.id, name: v.companyName })));
        } catch (_) {}
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

  const deleteOrder = async (orderId) => {
    try {
      const ORIGIN2 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN2 && ORIGIN2.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN2 || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const resp = await fetch(`${baseUrl}/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (resp.ok) {
        setOrders(prev => prev.filter(o => (o._id || o.id) !== orderId));
        toast.success('Order deleted');
      } else {
        toast.error('Failed to delete order');
      }
    } catch (e) {
      toast.error('Failed to delete order');
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const orderNum = String(order.orderNumber || '').toLowerCase();
        const custEmail = String(order.user?.email || order.customerEmail || '').toLowerCase();
        return orderNum.includes(q) || custEmail.includes(q);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Email filter
    if (emailFilter) {
      const e = emailFilter.toLowerCase();
      filtered = filtered.filter(order => (order.user?.email || order.customerEmail || '').toLowerCase().includes(e));
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`);
      filtered = filtered.filter(order => {
        const created = new Date(order.createdAt);
        return created >= from;
      });
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`);
      filtered = filtered.filter(order => {
        const created = new Date(order.createdAt);
        return created <= to;
      });
    }

    // Vendor filter
    if (vendorFilter) {
      filtered = filtered.filter(order => {
        const itemVendors = Array.from(new Set((order.items || []).map(i => String(i.vendor)).filter(Boolean)));
        return itemVendors.includes(String(vendorFilter));
      });
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setEmailFilter(draftEmail);
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    setVendorFilter(draftVendor);
  };

  const resetFilters = () => {
    setDraftStatus('all');
    setDraftEmail('');
    setDraftFrom('');
    setDraftTo('');
    setDraftVendor('');
    setStatusFilter('all');
    setEmailFilter('');
    setDateFrom('');
    setDateTo('');
    setVendorFilter('');
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setStatusUpdating(true);
      const ORIGIN4 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN4 && ORIGIN4.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN4 || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const endpoint = isVendor ? `${baseUrl}/api/v1/orders/vendor/${orderId}/status` : `${baseUrl}/api/v1/orders/${orderId}/status`;
      const resp = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!resp.ok) throw new Error('Failed');
      const json = await resp.json();
      if (json?.success) {
        // If vendor response (scoped), merge into existing order shape
        const updated = json.data;
        setOrders(prev => prev.map(o => {
          if ((o._id === orderId || o.id === orderId)) {
            if (updated && updated.items && updated.items.length >= 0 && updated.user) {
              return { ...o, ...updated };
            }
            return updated;
          }
          return o;
        }));
        setSelectedOrder(updated);
        setShowStatusModal(false);
        toast.success(`Order status updated to ${newStatus}`);
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      toast.error('Failed to update order status');
    } finally { setStatusUpdating(false); }
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

  const getCustomerName = (order) => {
    try {
      if (order.user && (order.user.name || order.user.email)) {
        return order.user.name || order.user.email;
      }
      if (order.customer && (order.customer.name || order.customer.email)) {
        return order.customer.name || order.customer.email;
      }
    } catch (_) {}
    const customer = customers.find(c => (c.id === order.customerId));
    return customer ? customer.name : (order.customerEmail || 'Unknown Customer');
  };

  const getVendorName = (order) => {
    // Prefer item-level vendor display; if multiple, show 'Multiple'
    try {
      const vendorIds = Array.from(new Set((order.items || []).map(i => String(i.vendor)).filter(Boolean)));
      if (vendorIds.length === 0) return 'Unknown';
      if (vendorIds.length > 1) return 'Multiple';
      const v = vendors.find(v => String(v.id) === String(vendorIds[0]));
      return v ? (v.name || v.companyName || 'Unknown') : 'Unknown';
    } catch (_) { return 'Unknown'; }
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
    if (isVendor) {
      const subtotal = Number(order.vendorSubtotal || 0);
      const tax = Number(order.vendorTax || order.vendorTaxShare || 0);
      const shipping = Number(order.vendorShipping || order.vendorShippingShare || 0);
      const discount = Number(order.vendorDiscountShare || 0);
      return subtotal + tax + shipping - discount;
    }
    const subtotal = (order.items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const tax = (subtotal * Number(order.tax || 0)) / 100;
    const shipping = Number(order.shippingCost || 0);
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
          <div className="search-filter-container" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ minWidth: 280 }}
            />
            <button className="btn btn-secondary" onClick={() => setFiltersOpen(v => !v)}>
              {filtersOpen ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>
      </div>
      {filtersOpen && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-control">
              <label>Status</label>
              <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="filter-input">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="filter-control">
              <label>Vendor</label>
              <select value={draftVendor} onChange={(e) => setDraftVendor(e.target.value)} className="filter-input">
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name || v.companyName}</option>
                ))}
              </select>
            </div>
            <div className="filter-control" style={{ gridColumn: '1 / -1' }}>
              <label>Customer Email</label>
              <input type="email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} placeholder="email@example.com" className="filter-input" />
            </div>
            <div className="filter-control">
              <label>From</label>
              <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="filter-input" />
              <small className="filter-hint">dd-mm-yyyy</small>
            </div>
            <div className="filter-control">
              <label>To</label>
              <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="filter-input" />
              <small className="filter-hint">dd-mm-yyyy</small>
            </div>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={applyFilters}>Apply</button>
            <button className="btn btn-secondary" onClick={resetFilters}>Reset</button>
          </div>
        </div>
      )}
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
          <p>{formatCurrency(orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0))}</p>
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
              <tr key={order._id || order.id}>
                <td>
                  <div className="order-info">
                    <strong>#{order.orderNumber || order.id}</strong>
                    <small>{order.paymentMethod || ''}</small>
                  </div>
                </td>
                <td>
                  <div className="customer-info">
                    <strong>{getCustomerName(order)}</strong>
                    <small>{order.user?.email || order.customerEmail || ''}</small>
                  </div>
                </td>
                <td>{getVendorName(order)}</td>
                <td>
                  <span className="items-count">
                    {(order.items || []).length} item{(order.items || []).length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td>
                  <strong>{formatCurrency(calculateOrderTotal(order))}</strong>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                    {(() => {
                      const vendorCount = Array.from(new Set((order.items || []).map(i => String(i.vendor)).filter(Boolean))).length;
                      return vendorCount > 1 ? aggregateMultiVendorStatus(order) : order.status;
                    })()}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <span>{order.createdAt ? require('../../utils/date').formatDate(order.createdAt) : ''}</span>
                    <small>{order.createdAt ? require('../../utils/date').formatTime(order.createdAt) : ''}</small>
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
                    <button
                      onClick={() => deleteOrder(order._id || order.id)}
                      className="btn btn-danger btn-sm"
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
                      {(() => {
                        const vendorCount = Array.from(new Set((selectedOrder.items || []).map(i => String(i.vendor)).filter(Boolean))).length;
                        return vendorCount > 1 ? aggregateMultiVendorStatus(selectedOrder) : selectedOrder.status;
                      })()}
                    </span>
                    <span className="order-date">
                      {require('../../utils/date').formatDateTime(selectedOrder.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="order-sections">
                  <div className="section">
                    <h3>Customer Information</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Name:</label>
                        <span>{getCustomerName(selectedOrder)}</span>
                      </div>
                      <div className="info-item">
                        <label>Email:</label>
                        <span>{selectedOrder.user?.email || selectedOrder.customerEmail || ''}</span>
                      </div>
                      <div className="info-item">
                        <label>Phone:</label>
                        <span>{selectedOrder.customerPhone || selectedOrder.user?.phone || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Address:</label>
                        <span>{selectedOrder.shippingAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="section">
                    <h3>Order Items</h3>
                    {(() => {
                      const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
                      const byVendor = new Map();
                      items.forEach(it => {
                        const vid = String(it.vendor || 'unknown');
                        if (!byVendor.has(vid)) byVendor.set(vid, []);
                        byVendor.get(vid).push(it);
                      });
                      const vendorKeys = Array.from(byVendor.keys());
                      if (vendorKeys.length <= 1) {
                        return (
                          <div className="order-items">
                            {items.map((item, index) => (
                              <div key={index} className="order-item">
                                <img src={item.image || '/default-product.png'} alt={item.name} />
                                <div className="item-details">
                                  <h4>{item.name}</h4>
                                  <p>SKU: {item.sku}</p>
                                  <p>Quantity: {item.quantity}</p>
                                  <p>Price: {formatCurrency(isVendor ? (item.vendorDisplayUnitPrice ?? item.vendorUnitPrice ?? item.price) : item.price)}</p>
                                </div>
                                <div className="item-total">
                                  {formatCurrency(((isVendor ? (item.vendorLineTotal ?? ((item.vendorDisplayUnitPrice ?? item.vendorUnitPrice ?? item.price) * item.quantity)) : (item.price * item.quantity))))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div className="order-items">
                          {vendorKeys.map((vid, idx) => (
                            <div key={vid} className="package-group">
                              <div className="package-header">
                                <strong>Package {idx + 1}</strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <small>{(() => { const v = vendors.find(v => String(v.id) === String(vid)); return v ? (v.name || v.companyName) : ''; })()}</small>
                                  {(() => {
                                    try {
                                      const vsMap = selectedOrder.vendorStatuses || {};
                                      const raw = vsMap[vid] || selectedOrder.status;
                                      const norm = normalizeStatus(raw);
                                      const label = norm.charAt(0).toUpperCase() + norm.slice(1);
                                      return (
                                        <span className={`status-badge ${getStatusBadgeClass(norm)}`}>
                                          {label}
                                        </span>
                                      );
                                    } catch (_) { return null; }
                                  })()}
                                </div>
                              </div>
                              {byVendor.get(vid).map((item, index) => (
                                <div key={index} className="order-item">
                                  <img src={item.image || '/default-product.png'} alt={item.name} />
                                  <div className="item-details">
                                    <h4>{item.name}</h4>
                                    <p>SKU: {item.sku}</p>
                                    <p>Quantity: {item.quantity}</p>
                                    <p>Price: {formatCurrency(isVendor ? (item.vendorDisplayUnitPrice ?? item.vendorUnitPrice ?? item.price) : item.price)}</p>
                                  </div>
                                  <div className="item-total">
                                      {formatCurrency(((isVendor ? (item.vendorLineTotal ?? ((item.vendorDisplayUnitPrice ?? item.vendorUnitPrice ?? item.price) * item.quantity)) : (item.price * item.quantity))))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="section">
                    <h3>Order Summary</h3>
                    <div className="order-summary">
                      {selectedOrder.couponCode && (
                        <div className="summary-row">
                          <span>Coupon:</span>
                          <span>{selectedOrder.couponCode}</span>
                        </div>
                      )}
                      {Number(selectedOrder.discountAmount || 0) > 0 && (
                        <div className="summary-row">
                          <span>Discount:</span>
                          <span>- ₹{Number(selectedOrder.discountAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {!isVendor ? (
                        <>
                          <div className="summary-row">
                            <span>Subtotal:</span>
                            <span>{formatCurrency((selectedOrder.items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0))}</span>
                          </div>
                          <div className="summary-row">
                            <span>Tax ({Number(selectedOrder.tax || 0)}%):</span>
                            <span>{formatCurrency((((selectedOrder.items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0) * Number(selectedOrder.tax || 0)) / 100))}</span>
                          </div>
                          <div className="summary-row">
                            <span>Shipping:</span>
                            <span>{formatCurrency(Number(selectedOrder.shippingCost || 0))}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="summary-row">
                            <span>Vendor Subtotal:</span>
                            <span>{formatCurrency(Number(selectedOrder.vendorSubtotal || 0))}</span>
                          </div>
                          <div className="summary-row">
                            <span>Vendor Tax Share:</span>
                            <span>{formatCurrency(Number(selectedOrder.vendorTax || selectedOrder.vendorTaxShare || 0))}</span>
                          </div>
                          <div className="summary-row">
                            <span>Vendor Shipping Share:</span>
                            <span>{formatCurrency(Number(selectedOrder.vendorShipping || selectedOrder.vendorShippingShare || 0))}</span>
                          </div>
                          {Number(selectedOrder.vendorDiscountShare || 0) > 0 && (
                            <div className="summary-row">
                              <span>Vendor Discount Share:</span>
                              <span>- {formatCurrency(Number(selectedOrder.vendorDiscountShare || 0))}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="summary-row total">
                        <span>Total:</span>
                        <span>{formatCurrency(calculateOrderTotal(selectedOrder))}</span>
                      </div>
                      {selectedOrder.orderNote && (
                        <div className="summary-row">
                          <span>Order Note:</span>
                          <span>{selectedOrder.orderNote}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                    <div className="section">
                      <h3>Status History</h3>
                      <div className="status-history">
                        {selectedOrder.statusHistory.map((history, index) => (
                          <div key={index} className="history-item">
                            <span className="status">{history.status}</span>
                            <span className="date">{require('../../utils/date').formatDateTime(history.timestamp)}</span>
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
                    <p><strong>Date:</strong> {require('../../utils/date').formatDate(selectedOrder.createdAt)}</p>
                    <p><strong>Due Date:</strong> {require('../../utils/date').formatDate(selectedOrder.createdAt)}</p>
                  </div>
                </div>

                <div className="invoice-sections">
                  <div className="invoice-section">
                    <h4>Bill To:</h4>
                    <p>{getCustomerName(selectedOrder)}</p>
                    <p>{selectedOrder.user?.email || selectedOrder.customerEmail || ''}</p>
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
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusUpdate(selectedOrder._id || selectedOrder.id, e.target.value)}
                    className="filter-select"
                    disabled={statusUpdating}
                  >
                    {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {statusUpdating && (
                    <div className="loading-inline" style={{ marginTop: 8 }}>
                      <div className="spinner"></div>
                      Updating status...
                    </div>
                  )}
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