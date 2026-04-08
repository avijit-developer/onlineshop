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
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  // Draft filters (edited in UI before Apply)
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftOrderId, setDraftOrderId] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftVendor, setDraftVendor] = useState('');
  const [draftDriver, setDraftDriver] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFrom, setCsvFrom] = useState('');
  const [csvTo, setCsvTo] = useState('');
  const [approvedDrivers, setApprovedDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverAssigning, setDriverAssigning] = useState(false);
  const [commissionDrafts, setCommissionDrafts] = useState({});
  const [commissionSavingId, setCommissionSavingId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);

  const normalizeAddress = (addr) => {
    try {
      if (!addr) return '';
      const parts = String(addr).split(',').map(s => s.trim()).filter(Boolean);
      return parts.join(', ');
    } catch (_) { return String(addr || ''); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('adminUser') || 'null'); } catch { return null; }
  })();
  const isVendor = currentUser?.role === 'vendor';
  const isSuperAdmin = currentUser?.role === 'admin';

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
  }, [orders, searchTerm, statusFilter, dateFrom, dateTo, orderIdFilter, vendorFilter, driverFilter]);

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
            const ordersData = json.data || [];
            console.log('📦 Orders fetched from API:', ordersData.length);
            if (ordersData.length > 0) {
              console.log('📦 First order sample:', JSON.stringify(ordersData[0], null, 2));
              console.log('📦 First order deliveryLatitude:', ordersData[0].deliveryLatitude);
              console.log('📦 First order deliveryLongitude:', ordersData[0].deliveryLongitude);
            }
            setOrders(ordersData);
            setCommissionDrafts(Object.fromEntries((ordersData || []).map(order => [String(order._id || order.id), String(order.driverCommission ?? '')])));
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

  const fetchApprovedDrivers = async () => {
    try {
      setDriversLoading(true);
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const resp = await fetch(`${baseUrl}/api/v1/drivers?status=approved&page=1&limit=1000`, {
        headers: getAuthHeaders()
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || 'Failed to load approved drivers');
      const drivers = Array.isArray(json?.data) ? json.data.filter(driver => driver.enabled !== false) : [];
      setApprovedDrivers(drivers);
    } catch (error) {
      toast.error(error.message || 'Failed to load approved drivers');
    } finally {
      setDriversLoading(false);
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        return;
      }
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

    // Search filter - only by Order ID
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const orderNum = String(order.orderNumber || order._id || order.id || '').toLowerCase();
        return orderNum.includes(q);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => {
        const orderStatus = normalizeStatus(order.status);
        const filterStatus = normalizeStatus(statusFilter);
        return orderStatus === filterStatus;
      });
    }

    // Order ID filter
    if (orderIdFilter) {
      const orderId = orderIdFilter.toLowerCase();
      filtered = filtered.filter(order => {
        const orderNum = String(order.orderNumber || order._id || order.id || '').toLowerCase();
        return orderNum.includes(orderId);
      });
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

    if (driverFilter) {
      filtered = filtered.filter(order => {
        const assignedDriverId = String(order?.driver?._id || order?.driver?.id || order?.driver || '');
        return assignedDriverId === String(driverFilter);
      });
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setOrderIdFilter(draftOrderId);
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    setVendorFilter(draftVendor);
    setDriverFilter(draftDriver);
  };

  const resetFilters = () => {
    setDraftStatus('all');
    setDraftOrderId('');
    setDraftFrom('');
    setDraftTo('');
    setDraftVendor('');
    setDraftDriver('');
    setStatusFilter('all');
    setOrderIdFilter('');
    setDateFrom('');
    setDateTo('');
    setVendorFilter('');
    setDriverFilter('');
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
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json?.message || 'Failed to update order status');
      }
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
      toast.error(error?.message || 'Failed to update order status');
    } finally { setStatusUpdating(false); }
  };

  const handleViewDetails = (order) => {
    console.log('📦 Selected Order for Details:', JSON.stringify(order, null, 2));
    console.log('📦 Order deliveryLatitude:', order?.deliveryLatitude);
    console.log('📦 Order deliveryLongitude:', order?.deliveryLongitude);
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleViewInvoice = (order) => {
    setSelectedOrder(order);
    setShowInvoiceModal(true);
  };

  const handleAssignDelivery = (order) => {
    if (['delivered', 'cancelled', 'canceled', 'refunded'].includes(String(order?.status || '').toLowerCase())) {
      toast.error('Delivered, cancelled, or refunded orders cannot be assigned or changed');
      return;
    }
    setSelectedOrder(order);
    setSelectedDriverId(order?.driver?._id || order?.driver?.id || order?.driver || '');
    setDriverSearchTerm('');
    setShowDeliveryModal(true);
    fetchApprovedDrivers();
  };

  const saveDriverCommission = async (order) => {
    try {
      const orderId = String(order._id || order.id);
      const value = commissionDrafts[orderId];
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error('Enter a valid non-negative commission');
        return;
      }
      setCommissionSavingId(orderId);
      const ORIGIN2 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN2 && ORIGIN2.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN2 || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const resp = await fetch(`${baseUrl}/api/v1/orders/${orderId}/driver-commission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ driverCommission: amount })
      });
      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json?.success) throw new Error(json?.message || 'Failed to update commission');
      const updatedOrder = json.data;
      setOrders(prev => prev.map(item => (
        String(item._id || item.id) === String(updatedOrder._id || updatedOrder.id) ? { ...item, ...updatedOrder } : item
      )));
      setCommissionDrafts(prev => ({ ...prev, [orderId]: String(updatedOrder.driverCommission ?? 0) }));
      toast.success('Driver commission updated');
    } catch (e) {
      toast.error(e?.message || 'Failed to update commission');
    } finally {
      setCommissionSavingId('');
    }
  };

  const assignSelectedDriver = async () => {
    try {
      if (!selectedOrder) return;
      if (!selectedDriverId) {
        toast.error('Please select a driver');
        return;
      }
      setDriverAssigning(true);
      const ORIGIN2 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN2 && ORIGIN2.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN2 || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const resp = await fetch(`${baseUrl}/api/v1/orders/${selectedOrder._id || selectedOrder.id}/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ driverId: selectedDriverId })
      });
      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json?.success) throw new Error(json?.message || 'Failed to assign driver');
      const updatedOrder = json.data;
      setOrders(prev => prev.map(order => (
        String(order._id || order.id) === String(updatedOrder._id || updatedOrder.id) ? { ...order, ...updatedOrder } : order
      )));
      setSelectedOrder(updatedOrder);
      setShowDeliveryModal(false);
      toast.success('Driver assigned successfully');
    } catch (e) {
      toast.error(e?.message || 'Failed to assign driver');
    } finally {
      setDriverAssigning(false);
    }
  };

  const removeAssignedDriver = async () => {
    try {
      if (!selectedOrder) return;
      setDriverAssigning(true);
      const ORIGIN2 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN2 && ORIGIN2.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN2 || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const resp = await fetch(`${baseUrl}/api/v1/orders/${selectedOrder._id || selectedOrder.id}/assign-driver`, {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json?.success) throw new Error(json?.message || 'Failed to remove driver');
      const updatedOrder = json.data;
      setOrders(prev => prev.map(order => (
        String(order._id || order.id) === String(updatedOrder._id || updatedOrder.id) ? { ...order, ...updatedOrder } : order
      )));
      setSelectedOrder(updatedOrder);
      setSelectedDriverId('');
      toast.success('Driver removed successfully');
    } catch (e) {
      toast.error(e?.message || 'Failed to remove driver');
    } finally {
      setDriverAssigning(false);
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

  const driverOptions = Array.from(
    new Map(
      orders
        .filter(order => order?.driver?._id || order?.driver?.id || order?.driver)
        .map(order => {
          const driverId = String(order?.driver?._id || order?.driver?.id || order?.driver || '');
          const driverName = order?.driver?.name || 'Unknown Driver';
          const driverEmail = order?.driver?.email || '';
          return [driverId, { id: driverId, name: driverName, email: driverEmail }];
        })
    ).values()
  );

  const isTerminalOrder = (order) => {
    const status = String(order?.status || '').toLowerCase();
    const driverStatus = String(order?.driverStatus || '').toLowerCase();
    if (['delivered', 'cancelled', 'canceled', 'refunded'].includes(status)) return true;
    return ['delivered', 'delivery_completed'].includes(driverStatus);
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
      case 'pickup_completed':
        return 'status-processing';
      case 'on_the_way':
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

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'pickup_completed', label: 'Pickup Completed' },
    { value: 'on_the_way', label: 'On The Way' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' }
  ];

  const getAdminStatusValue = (order) => {
    const driverStatus = String(order?.driverStatus || '').toLowerCase();
    if (driverStatus === 'delivery_completed') return 'delivered';
    if (['pickup_completed', 'on_the_way', 'delivered'].includes(driverStatus)) return driverStatus;
    return String(order?.status || 'pending').toLowerCase();
  };

  const filteredApprovedDrivers = approvedDrivers.filter(driver => {
    const term = String(driverSearchTerm || '').trim().toLowerCase();
    if (!term) return true;
    return [
      driver.name,
      driver.email,
      driver.phone,
      driver.city,
      driver.busyOrderNumber
    ].some(value => String(value || '').toLowerCase().includes(term));
  });

  const calculateOrderTotal = (order) => {
    if (isVendor) {
      // For vendors, total should be vendor prices sum only (no tax/shipping/discount)
      if (order.vendorSubtotal != null) return Number(order.vendorSubtotal);
      const items = Array.isArray(order.items) ? order.items : [];
      const subtotal = items.reduce((sum, it) => {
        const unit = (it.vendorDisplayUnitPrice != null)
          ? Number(it.vendorDisplayUnitPrice)
          : (it.vendorUnitPrice != null)
            ? Number(it.vendorUnitPrice)
            : Number(it.price || 0);
        return sum + unit * Number(it.quantity || 0);
      }, 0);
      return subtotal;
    }
    const subtotal = (order.items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const tax = (subtotal * Number(order.tax || 0)) / 100;
    const shipping = Number(order.shippingCost || 0);
    return subtotal + tax + shipping;
  };

  const downloadInvoice = async () => {
    try {
      if (!selectedOrder) return;
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const orderId = selectedOrder._id || selectedOrder.id;
      const resp = await fetch(`${baseUrl}/api/v1/orders/${orderId}/invoice.pdf`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!resp.ok) { toast.error('Failed to download invoice'); return; }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fname = `invoice-${selectedOrder.orderNumber || orderId}.pdf`;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch (e) {
      toast.error('Failed to download invoice');
    }
  };
 
  const escapeCsv = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatCsvDate = (d) => {
    try {
      return require('../../utils/date').formatDateTime(d);
    } catch (_) {
      return String(d || '');
    }
  };

  const buildOrdersCsv = (rows) => {
    const headers = [
      'Order ID',
      'Order Number',
      'Status',
      'Created At',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Vendor',
      'Items',
      'Subtotal',
      'Tax',
      'Shipping',
      'Total'
    ];
    const lines = [headers.map(escapeCsv).join(',')];
    rows.forEach(order => {
      const orderId = order._id || order.id || '';
      const orderNumber = order.orderNumber || '';
      const status = aggregateMultiVendorStatus(order) || order.status || '';
      const createdAt = formatCsvDate(order.createdAt);
      const customerName = getCustomerName(order);
      const customerEmail = order.user?.email || order.customerEmail || '';
      const customerPhone = order.customerPhone || order.user?.phone || '';
      const vendorName = getVendorName(order);
      const itemsText = (order.items || []).map(it => {
        const name = it.name || '';
        const qty = it.quantity || 0;
        const price = it.price ?? '';
        return `${name} x${qty} @ ${price}`;
      }).join(' | ');
      const subtotal = isVendor
        ? (order.vendorSubtotal != null ? Number(order.vendorSubtotal) : calculateOrderTotal({ ...order, tax: 0, shippingCost: 0 }))
        : (order.items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      const tax = isVendor ? '' : Number(order.tax || 0);
      const shipping = isVendor ? '' : Number(order.shippingCost || 0);
      const total = calculateOrderTotal(order);
      const row = [
        orderId,
        orderNumber,
        status,
        createdAt,
        customerName,
        customerEmail,
        customerPhone,
        vendorName,
        itemsText,
        subtotal,
        tax,
        shipping,
        total
      ].map(escapeCsv).join(',');
      lines.push(row);
    });
    return lines.join('\n');
  };

  const downloadOrdersCsv = (rows, label) => {
    if (!rows || rows.length === 0) {
      toast.error('No orders to export');
      return;
    }
    const csv = buildOrdersCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateTag = new Date().toISOString().slice(0, 10);
    a.download = `orders-${label}-${dateTag}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const openCsvModal = () => {
    setCsvFrom(draftFrom || dateFrom || '');
    setCsvTo(draftTo || dateTo || '');
    setShowCsvModal(true);
  };

  const exportCsvByDateRange = () => {
    let rows = filteredOrders;
    if (csvFrom || csvTo) {
      const from = csvFrom ? new Date(`${csvFrom}T00:00:00`) : null;
      const to = csvTo ? new Date(`${csvTo}T23:59:59.999`) : null;
      rows = rows.filter(order => {
        const created = new Date(order.createdAt);
        if (from && created < from) return false;
        if (to && created > to) return false;
        return true;
      });
    }
    downloadOrdersCsv(rows, 'date-range');
    setShowCsvModal(false);
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
              placeholder="Search by Order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ minWidth: 280 }}
            />
            <button className="btn btn-secondary" onClick={() => setFiltersOpen(v => !v)}>
              {filtersOpen ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              className="btn btn-success"
              onClick={openCsvModal}
              title="Download filtered orders as CSV"
            >
              Download CSV
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
            <div className="filter-control">
              <label>Driver</label>
              <select value={draftDriver} onChange={(e) => setDraftDriver(e.target.value)} className="filter-input">
                <option value="">All Drivers</option>
                {driverOptions.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}{driver.email ? ` (${driver.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-control" style={{ gridColumn: '1 / -1' }}>
              <label>Order ID</label>
              <input type="text" value={draftOrderId} onChange={(e) => setDraftOrderId(e.target.value)} placeholder="Enter Order ID" className="filter-input" />
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
              <th>Vendor</th>
              <th>Driver</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              {isSuperAdmin ? <th>Driver Commission</th> : null}
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
                <td>{getVendorName(order)}</td>
                <td>
                  <div className="customer-info">
                    <strong>{order?.driver?.name || 'Unassigned'}</strong>
                    {order?.driver?.email ? <small>{order.driver.email}</small> : null}
                  </div>
                </td>
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
                {isSuperAdmin ? (
                  <td>
                    {String(order.status || '').toLowerCase() === 'delivered' ? (
                      <div className="driver-commission-cell">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="driver-commission-input"
                          value={commissionDrafts[String(order._id || order.id)] ?? String(order.driverCommission ?? '')}
                          onChange={(e) => setCommissionDrafts(prev => ({ ...prev, [String(order._id || order.id)]: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveDriverCommission(order)}
                          disabled={commissionSavingId === String(order._id || order.id)}
                        >
                          {commissionSavingId === String(order._id || order.id) ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <span className="driver-commission-muted">Available after delivered</span>
                    )}
                  </td>
                ) : null}
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
                      style={{ display: isVendor ? 'none' : undefined }}
                      disabled={isTerminalOrder(order)}
                    >
                      {order?.driver?.name ? 'Reassign Driver' : 'Assign Driver'}
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
                      style={{ display: isVendor ? 'none' : undefined }}
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
                    {!isVendor && (
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
                            <span>{normalizeAddress(selectedOrder.shippingAddress)}</span>
                          </div>
                          {/* Always show lat/long fields, even if null */}
                          <div className="info-item">
                            <label>Latitude:</label>
                            <span>{selectedOrder.deliveryLatitude != null ? Number(selectedOrder.deliveryLatitude).toFixed(6) : 'N/A'}</span>
                          </div>
                          <div className="info-item">
                            <label>Longitude:</label>
                            <span>{selectedOrder.deliveryLongitude != null ? Number(selectedOrder.deliveryLongitude).toFixed(6) : 'N/A'}</span>
                          </div>
                          {(selectedOrder.deliveryLatitude != null && selectedOrder.deliveryLongitude != null) && (
                            <div className="info-item">
                              <label>Location:</label>
                              <a 
                                href={`https://www.google.com/maps?q=${selectedOrder.deliveryLatitude},${selectedOrder.deliveryLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#007bff', textDecoration: 'underline', cursor: 'pointer' }}
                              >
                                View on Google Maps
                              </a>
                            </div>
                          )}
                          <div className="info-item">
                            <label>Assigned Driver:</label>
                            <span>{selectedOrder.driver?.name ? `${selectedOrder.driver.name} (${selectedOrder.driver.email || 'No email'})` : 'Not assigned'}</span>
                          </div>
                          <div className="info-item">
                            <label>Driver Status:</label>
                            <span>{selectedOrder.driverStatus || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    )}

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

                  {selectedOrder.cancellationReason && (
                    <div className="section">
                      <h3>Cancellation Reason</h3>
                      <div style={{ padding: '12px', backgroundColor: '#fff5f5', border: '1px solid #ffebee', borderRadius: '8px' }}>
                        <p style={{ margin: 0, color: '#333' }}>{selectedOrder.cancellationReason}</p>
                      </div>
                    </div>
                  )}

                  <div className="section">
                    <h3>Order Summary</h3>
                    <div className="order-summary">
                      {!isVendor && selectedOrder.couponCode && (
                        <div className="summary-row">
                          <span>Coupon:</span>
                          <span>{selectedOrder.couponCode}</span>
                        </div>
                      )}
                      {!isVendor && Number(selectedOrder.discountAmount || 0) > 0 && (
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
                            <span>Subtotal:</span>
                            <span>{formatCurrency((() => {
                              if (selectedOrder.vendorSubtotal != null) return Number(selectedOrder.vendorSubtotal);
                              const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
                              return items.reduce((sum, it) => {
                                const unit = (it.vendorDisplayUnitPrice != null)
                                  ? Number(it.vendorDisplayUnitPrice)
                                  : (it.vendorUnitPrice != null)
                                    ? Number(it.vendorUnitPrice)
                                    : Number(it.price || 0);
                                return sum + unit * Number(it.quantity || 0);
                              }, 0);
                            })())}</span>
                          </div>
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
                  {!isVendor && (
                    <div className="invoice-section">
                      <h4>Bill To:</h4>
                      <p>{getCustomerName(selectedOrder)}</p>
                      <p>{selectedOrder.user?.email || selectedOrder.customerEmail || ''}</p>
                      <p>{normalizeAddress(selectedOrder.shippingAddress)}</p>
                      {/* Always show lat/long fields */}
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>
                          <strong>Latitude:</strong> {selectedOrder.deliveryLatitude != null ? Number(selectedOrder.deliveryLatitude).toFixed(6) : 'N/A'}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>
                          <strong>Longitude:</strong> {selectedOrder.deliveryLongitude != null ? Number(selectedOrder.deliveryLongitude).toFixed(6) : 'N/A'}
                        </p>
                        {(selectedOrder.deliveryLatitude != null && selectedOrder.deliveryLongitude != null) && (
                          <p style={{ margin: '4px 0', fontSize: '14px' }}>
                            <a 
                              href={`https://www.google.com/maps?q=${selectedOrder.deliveryLatitude},${selectedOrder.deliveryLongitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#007bff', textDecoration: 'underline' }}
                            >
                              View on Google Maps
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

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
                            <td>{formatCurrency(item.price)}</td>
                            <td>{formatCurrency((Number(item.price) * Number(item.quantity)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="invoice-summary">
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedOrder.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0))}</span>
                    </div>
                    <div className="summary-row">
                      <span>Tax:</span>
                      <span>{formatCurrency(((selectedOrder.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0) * Number(selectedOrder.tax || 0)) / 100))}</span>
                    </div>
                    <div className="summary-row">
                      <span>Shipping:</span>
                      <span>{formatCurrency(Number(selectedOrder.shippingCost || 0))}</span>
                    </div>
                    <div className="summary-row total">
                      <span>Total:</span>
                      <span>{formatCurrency(calculateOrderTotal(selectedOrder))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowInvoiceModal(false)} className="btn btn-secondary">
                Close
              </button>
              <button onClick={downloadInvoice} className="btn btn-success">
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Date Range Modal */}
      {showCsvModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Download Orders CSV</h2>
              <button onClick={() => setShowCsvModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="filters-grid">
                <div className="filter-control">
                  <label>From</label>
                  <input
                    type="date"
                    value={csvFrom}
                    max={csvTo || undefined}
                    onChange={(e) => setCsvFrom(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-control">
                  <label>To</label>
                  <input
                    type="date"
                    value={csvTo}
                    min={csvFrom || undefined}
                    onChange={(e) => setCsvTo(e.target.value)}
                    className="filter-input"
                  />
                </div>
              </div>
              <small className="filter-hint">Leave empty to export all filtered orders.</small>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCsvModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={exportCsvByDateRange} className="btn btn-success">
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
                <p>Current Status: <span className={`status-badge ${getStatusBadgeClass(getAdminStatusValue(selectedOrder))}`}>{getAdminStatusValue(selectedOrder)}</span></p>
                <div className="status-options">
                  <select
                    value={getAdminStatusValue(selectedOrder)}
                    onChange={(e) => handleStatusUpdate(selectedOrder._id || selectedOrder.id, e.target.value)}
                    className="filter-select"
                    disabled={statusUpdating}
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
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
              <h2>Assign Driver</h2>
              <button onClick={() => setShowDeliveryModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="delivery-partners">
                <div className="delivery-header-row">
                  <p>Select an approved driver for order #{selectedOrder.orderNumber}:</p>
                  <div className="assigned-driver-note">
                    Current driver: {selectedOrder.driver?.name ? `${selectedOrder.driver.name} (${selectedOrder.driver.email || 'No email'})` : 'Not assigned'}
                  </div>
                </div>
                <input
                  type="text"
                  className="driver-search-input"
                  placeholder="Find driver by name, email, phone, city, or order"
                  value={driverSearchTerm}
                  onChange={(e) => setDriverSearchTerm(e.target.value)}
                />
                {driversLoading ? (
                  <div className="loading-inline">
                    <div className="spinner"></div>
                    Loading approved drivers...
                  </div>
                ) : approvedDrivers.length === 0 ? (
                  <div className="driver-empty-state">No approved drivers are available right now.</div>
                ) : filteredApprovedDrivers.length === 0 ? (
                  <div className="driver-empty-state">No drivers match your search.</div>
                ) : (
                  <div className="driver-dropdown-wrap">
                    <select
                      className="driver-dropdown"
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                    >
                      <option value="">Select driver</option>
                      {filteredApprovedDrivers.map(driver => {
                        const driverId = driver._id || driver.id;
                        const isBusyOnCurrentOrder = String(driver.busyOrderId || '') === String(selectedOrder._id || selectedOrder.id || '');
                        const isBusy = Boolean(driver.isBusy && !isBusyOnCurrentOrder);
                        const label = `${driver.name} - ${driver.email}${isBusy ? ` (Busy: #${driver.busyOrderNumber || driver.busyOrderId})` : ''}`;
                        return (
                          <option key={driverId} value={driverId} disabled={isBusy}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeliveryModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={removeAssignedDriver}
                className="btn btn-warning"
                disabled={driverAssigning || !selectedOrder?.driver}
              >
                {driverAssigning ? 'Removing...' : 'Remove Driver'}
              </button>
              <button
                onClick={assignSelectedDriver}
                className="btn btn-primary"
                disabled={driverAssigning || driversLoading || approvedDrivers.length === 0 || !selectedDriverId}
              >
                {driverAssigning ? 'Assigning...' : 'Assign Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders; 
