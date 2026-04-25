import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../../utils/currency';
import { toast } from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './Dashboard.css';
import { createAdminSocket } from '../../utils/socket';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('adminUser') || 'null'); } catch { return null; }
  })();
  const isVendor = currentUser?.role === 'vendor';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadDashboardData();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const socket = createAdminSocket();
    if (!socket) return undefined;

    const getOrderLabel = (event) => {
      const order = event?.order || {};
      return order.orderNumber || order._id || order.id || 'new order';
    };

    const refreshDashboard = (event) => {
      if (event?.meta?.source === 'customer') {
        toast.success(`New order received: ${getOrderLabel(event)}`);
      }
      loadDashboardData({ showLoading: false });
    };

    const refreshDashboardOnUpdate = (event) => {
      if (event?.meta?.action === 'cancel') return;
      if (event?.meta?.action === 'reschedule') {
        const order = event?.order || {};
        const driverName = event?.meta?.driver?.name || order?.driverReschedule?.requestedByName || order?.driver?.name || 'Driver';
        const rescheduleDate = event?.meta?.rescheduleDate || order?.driverReschedule?.rescheduleDate;
        const dateLabel = rescheduleDate ? require('../../utils/date').formatDateTime(rescheduleDate) : 'a new date';
        toast.success(`Order #${getOrderLabel(event)} rescheduled by ${driverName} for ${dateLabel}`);
      }
      loadDashboardData({ showLoading: false });
    };

    socket.on('order:created', refreshDashboard);
    socket.on('order:updated', refreshDashboardOnUpdate);
    socket.on('order:deleted', refreshDashboard);
    socket.on('order:cancelled', refreshDashboard);

    return () => {
      socket.off('order:created', refreshDashboard);
      socket.off('order:updated', refreshDashboardOnUpdate);
      socket.off('order:deleted', refreshDashboard);
      socket.off('order:cancelled', refreshDashboard);
      socket.disconnect();
    };
  }, []);

  const loadDashboardData = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Vendor path: build dashboard without hitting admin-only endpoint
      if (isVendor) {
        try {
          const token = localStorage.getItem('adminToken');
          const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
          const BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || ''));
          // Fetch vendors assigned and vendor orders for stats
          const [vres, ores] = await Promise.all([
            fetch(`${BASE}/api/v1/vendors?page=1&limit=100`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => null),
            fetch(`${BASE}/api/v1/orders/vendor?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
          ]);
          let vendorsList = [];
          if (vres && vres.ok) {
            try {
              const vjson = await vres.json();
              vendorsList = (vjson?.data || []).map(v => ({ id: v._id || v.id, companyName: v.companyName, status: v.status, enabled: v.enabled }));
            } catch (_) {}
          }
          let vendorOrders = [];
          if (ores && ores.ok) {
            const ojson = await ores.json();
            vendorOrders = ojson?.data || [];
          }
          // Compute vendor summary metrics and series
          const sum = (arr, sel) => arr.reduce((acc, it) => acc + Number(sel(it) || 0), 0);
          const isDelivered = (o) => {
            const s = String(o.status || '').toLowerCase();
            return s === 'delivered' || s === 'completed';
          };
          const deliveredVendorOrders = (vendorOrders || []).filter(isDelivered);
          const vendorSubtotalSum = sum(deliveredVendorOrders, o => o.vendorSubtotal);
          const vendorCommissionSum = sum(deliveredVendorOrders, o => (o.vendorCommission != null ? o.vendorCommission : 0));
          const vendorNetSum = sum(deliveredVendorOrders, o => (o.vendorNet != null ? o.vendorNet : (Number(o.vendorSubtotal || 0) - Number(o.vendorCommission || 0))));
          const vendorSummary = { ordersCount: deliveredVendorOrders.length, subtotal: vendorSubtotalSum, commission: vendorCommissionSum, net: vendorNetSum };
          // Sales data
          const daily = Array(7).fill(0); const weekly = Array(7).fill(0); const monthly = Array(7).fill(0);
          const now = new Date(); const msPerDay = 24*60*60*1000;
          const revenueOf = (o) => Number(o.vendorSubtotal || 0);
          for (const o of deliveredVendorOrders) {
            const dt = o.createdAt ? new Date(o.createdAt) : null; if (!dt || isNaN(dt.getTime())) continue;
            const dow = dt.getDay(); const monIdx = (dow + 6) % 7; daily[monIdx] += revenueOf(o);
            const diffDays = Math.floor((now - dt) / msPerDay); const weeksAgo = Math.min(6, Math.max(0, Math.floor(diffDays / 7))); weekly[6 - weeksAgo] += revenueOf(o);
            const monthDiff = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth()); const clamped = Math.min(6, Math.max(0, monthDiff)); monthly[6 - clamped] += revenueOf(o);
          }
          const vendorSalesData = { daily, weekly, monthly };
          // Top products
          const productAgg = new Map();
          const productIdForKey = new Map();
          for (const o of vendorOrders) {
            const items = Array.isArray(o.items) ? o.items : [];
            for (const it of items) {
              const pid = it.product ? String(it.product) : null;
              const key = String(pid || it.sku || it.name || Math.random());
              const prev = productAgg.get(key) || { name: it.name, image: it.image, revenue: 0, quantity: 0, productId: pid };
              const unit = (it.vendorDisplayUnitPrice != null) ? Number(it.vendorDisplayUnitPrice) : (it.vendorUnitPrice != null ? Number(it.vendorUnitPrice) : Number(it.price || 0));
              const qty = Number(it.quantity || 0);
              prev.revenue += unit * qty; prev.quantity += qty; prev.name = it.name || prev.name; prev.image = it.image || prev.image; prev.productId = prev.productId || pid;
              productAgg.set(key, prev);
              if (pid) productIdForKey.set(key, pid);
            }
          }
          let vendorTopProducts = Array.from(productAgg.values()).sort((a,b)=>b.revenue-a.revenue).slice(0,7).map(p=>({ name:p.name, image:p.image, avgPrice: p.quantity>0 ? (p.revenue/p.quantity):0, quantity:p.quantity, revenue:p.revenue, productId: p.productId }));
          // Fetch stock for those with productId
          try {
            const token = localStorage.getItem('adminToken');
            const ORIGIN2 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
            const BASE2 = process.env.REACT_APP_API_URL || (ORIGIN2 && ORIGIN2.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN2 || ''));
            const withIds = vendorTopProducts.filter(p => p.productId);
            const stocks = await Promise.all(withIds.map(async p => {
              try { const r = await fetch(`${BASE2}/api/v1/products/${p.productId}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }); if (!r.ok) return { id:p.productId, stock: undefined }; const j = await r.json(); return { id:p.productId, stock: j?.data?.stock };
              } catch { return { id:p.productId, stock: undefined }; }
            }));
            const idToStock = new Map(stocks.map(s => [String(s.id), s.stock]));
            vendorTopProducts = vendorTopProducts.map(p => ({ ...p, stock: p.productId ? idToStock.get(String(p.productId)) : undefined }));
          } catch (_) {}

          // Minimal admin dashboard stub to satisfy existing rendering paths
          const stubDashboard = { stats: { totalSales: 0, totalOrders: 0, totalVendors: vendorsList.length, totalCustomers: 0, pendingApprovals: 0 }, recentOrders: [], topProducts: [] };
          setData({ dashboard: stubDashboard, orders: [], products: [], vendors: vendorsList, vendorOrders, vendorSummary, vendorSalesData, vendorTopProducts, users: [] });
          return;
        } catch (_) { /* fall through to admin path if vendor fetch fails */ }
      }
      try {
        const token = localStorage.getItem('adminToken');
        const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
        const BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || ''));
        const resp = await fetch(`${BASE}/api/v1/admin/dashboard`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success) {
            let vendorsList = [];
            let vendorOrders = [];
            let vendorSummary = null;
            let vendorSalesData = null;
            let vendorTopProducts = [];
            if (isVendor) {
              try {
                const vres = await fetch(`${BASE}/api/v1/vendors?page=1&limit=100`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
                if (vres.ok) {
                  const vjson = await vres.json();
                  vendorsList = (vjson?.data || []).map(v => ({ id: v._id || v.id, companyName: v.companyName, status: v.status, enabled: v.enabled }));
                }
                // Fetch a larger slice for stats
                const ores = await fetch(`${BASE}/api/v1/orders/vendor?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
                if (ores.ok) {
                  const ojson = await ores.json();
                  vendorOrders = ojson?.data || [];
                  // Compute vendor summary metrics
                  const sum = (arr, sel) => arr.reduce((acc, it) => acc + Number(sel(it) || 0), 0);
                  const isDelivered = (o) => {
                    const s = String(o.status || '').toLowerCase();
                    return s === 'delivered' || s === 'completed';
                  };
                  const deliveredVendorOrders = (vendorOrders || []).filter(isDelivered);
                  const vendorSubtotalSum = sum(deliveredVendorOrders, o => o.vendorSubtotal);
                  vendorSummary = {
                    ordersCount: deliveredVendorOrders.length,
                    subtotal: vendorSubtotalSum,
                  };
                  // Build vendor sales series
                  const daily = Array(7).fill(0); // Mon..Sun
                  const weekly = Array(7).fill(0); // last 7 weeks
                  const monthly = Array(7).fill(0); // last 7 months
                  const now = new Date();
                  const msPerDay = 24 * 60 * 60 * 1000;
                  const revenueOf = (o) => Number(o.vendorSubtotal || 0);
                  for (const o of deliveredVendorOrders) {
                    const dt = o.createdAt ? new Date(o.createdAt) : null;
                    if (!dt || isNaN(dt.getTime())) continue;
                    // Daily: map to Mon..Sun index
                    const dow = dt.getDay(); // 0..6, 0=Sun
                    const monIdx = (dow + 6) % 7; // 0=Mon .. 6=Sun
                    daily[monIdx] += revenueOf(o);
                    // Weekly: bucket by weeks ago (0..6)
                    const diffDays = Math.floor((now - dt) / msPerDay);
                    const weeksAgo = Math.min(6, Math.max(0, Math.floor(diffDays / 7)));
                    weekly[6 - weeksAgo] += revenueOf(o);
                    // Monthly: bucket by month difference (0..6)
                    const monthDiff = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth());
                    const clamped = Math.min(6, Math.max(0, monthDiff));
                    monthly[6 - clamped] += revenueOf(o);
                  }
                  vendorSalesData = { daily, weekly, monthly };
                  // Build top products for vendor by revenue
                  const productAgg = new Map();
                  for (const o of vendorOrders) {
                    const items = Array.isArray(o.items) ? o.items : [];
                    for (const it of items) {
                      const pid = it.product ? String(it.product) : null;
                      const key = String(pid || it.sku || it.name || Math.random());
                      const prev = productAgg.get(key) || { name: it.name, image: it.image, revenue: 0, quantity: 0, productId: pid };
                      const unit = (it.vendorDisplayUnitPrice != null) ? Number(it.vendorDisplayUnitPrice) : (it.vendorUnitPrice != null ? Number(it.vendorUnitPrice) : Number(it.price || 0));
                      const qty = Number(it.quantity || 0);
                      prev.revenue += unit * qty;
                      prev.quantity += qty;
                      prev.name = it.name || prev.name;
                      prev.image = it.image || prev.image;
                      prev.productId = prev.productId || pid;
                      productAgg.set(key, prev);
                    }
                  }
                  vendorTopProducts = Array.from(productAgg.values())
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 7)
                    .map(p => ({
                      name: p.name,
                      image: p.image,
                      avgPrice: p.quantity > 0 ? (p.revenue / p.quantity) : 0,
                      quantity: p.quantity,
                      revenue: p.revenue,
                      productId: p.productId
                    }));
                  try {
                    const token2 = localStorage.getItem('adminToken');
                    const ORIGINv = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
                    const BASEv = process.env.REACT_APP_API_URL || (ORIGINv && ORIGINv.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGINv || ''));
                    const withIds2 = vendorTopProducts.filter(p => p.productId);
                    const stocks2 = await Promise.all(withIds2.map(async p => {
                      try { const r = await fetch(`${BASEv}/api/v1/products/${p.productId}`, { headers: { Authorization: token2 ? `Bearer ${token2}` : '' } }); if (!r.ok) return { id:p.productId, stock: undefined }; const j = await r.json(); return { id:p.productId, stock: j?.data?.stock };
                      } catch { return { id:p.productId, stock: undefined }; }
                    }));
                    const idToStock2 = new Map(stocks2.map(s => [String(s.id), s.stock]));
                    vendorTopProducts = vendorTopProducts.map(p => ({ ...p, stock: p.productId ? idToStock2.get(String(p.productId)) : undefined }));
                  } catch (_) {}
                }
              } catch (_) {}
            }
            setData({
              dashboard: json.data,
              orders: json.data.recentOrders,
              products: json.data.topProducts,
              vendors: vendorsList,
              vendorOrders,
              vendorSummary,
              vendorSalesData,
              vendorTopProducts,
              users: []
            });
            return;
          }
        }
      } catch (e) {}
      const response = await fetch('/data.json');
      const jsonData = await response.json();
      setData(jsonData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [isVendor]);

  const getChartData = () => {
    if (!data) return null;

    const labels = {
      daily: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      weekly: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'],
      monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
    };

    const defaultSeries = {
      daily: Array(7).fill(0),
      weekly: Array(7).fill(0),
      monthly: Array(7).fill(0),
    };
    const salesData = isVendor
      ? (data.vendorSalesData || defaultSeries)
      : ((data.dashboard && data.dashboard.salesData) ? data.dashboard.salesData : defaultSeries);

    return {
      labels: labels[chartPeriod],
      datasets: [
        {
          label: 'Sales',
          data: salesData[chartPeriod] || defaultSeries[chartPeriod],
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="alert alert-danger">Failed to load dashboard data</div>;
  }

  const { stats, recentOrders, topProducts } = data.dashboard;
  const vendorSummary = data.vendorSummary || { ordersCount: 0, subtotal: 0 };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };
  const closeOrderDetails = () => {
    setShowOrderModal(false);
    setSelectedOrder(null);
  };

  

  return (
    <>
    <div className="dashboard">
      {/* Stats Cards */}
      <div className="stats-grid">
        {isVendor ? (
          <>
            <div className="stat-card">
              <h3>₹{vendorSummary.subtotal.toFixed(2)}</h3>
              <p>Vendor Revenue</p>
            </div>
            <div className="stat-card">
              <h3>{vendorSummary.ordersCount}</h3>
              <p>Total Completed Orders</p>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <h3>₹{stats.totalSales.toLocaleString()}</h3>
              <p>Total Sales</p>
            </div>
            <div className="stat-card">
              <h3>{stats.totalOrders}</h3>
              <p>Total Orders</p>
            </div>
            <div className="stat-card">
              <h3>{stats.totalVendors}</h3>
              <p>Total Vendors</p>
            </div>
            {!isVendor && (
              <div className="stat-card">
                <h3>{stats.totalCustomers}</h3>
                <p>Total Customers</p>
              </div>
            )}
            {!isVendor && (
              <div className="stat-card">
                <h3>{stats.pendingApprovals}</h3>
                <p>Vendor Pending Approvals</p>
              </div>
            )}
            {!isVendor && (
              <div className="stat-card">
                <h3>{stats.pendingProductApprovals || 0}</h3>
                <p>Product Pending Approvals</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="row row-equal">
        {/* Sales Chart */}
        <div className="col-8">
          <div className="chart-container">
            <div className="chart-header">
              <h3>Sales Overview</h3>
              <div className="chart-controls">
                <button
                  className={`btn btn-sm ${chartPeriod === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChartPeriod('daily')}
                >
                  Daily
                </button>
                <button
                  className={`btn btn-sm ${chartPeriod === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChartPeriod('weekly')}
                >
                  Weekly
                </button>
                <button
                  className={`btn btn-sm ${chartPeriod === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChartPeriod('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
            {getChartData() && <Line data={getChartData()} options={chartOptions} />}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="col-4">
          <div className="card">
            <h3>Recent Orders</h3>
            <div className="recent-orders">
              {isVendor ? (
                ([...((data.vendorOrders || []))].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5)).map((order) => (
                  <div key={order.id} className="order-item" onClick={() => openOrderDetails(order)} style={{ cursor: 'pointer' }}>
                    <div className="order-info">
                      <strong>{order.orderNumber}</strong>
                      <span className="order-amount">₹{Number(order.vendorSubtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="order-status">
                      <span className={`badge badge-${order.status === 'delivered' ? 'success' : order.status === 'shipped' ? 'info' : 'warning'}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                (Array.isArray(recentOrders) ? recentOrders : (Array.isArray(data.orders) ? data.orders : [])).map((order) => (
                  <div key={order._id || order.id} className="order-item" onClick={() => openOrderDetails(order)} style={{ cursor: 'pointer' }}>
                    <div className="order-info">
                      <strong>{order.orderNumber || order.id}</strong>
                      <span className="order-amount">₹{Number(order.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="order-status">
                      <span className={`badge badge-${order.status === 'delivered' ? 'success' : order.status === 'shipped' ? 'info' : 'warning'}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {isVendor && (
          <div className="col-6">
            <div className="card">
              <h3>Your Businesses</h3>
              <div className="pending-approvals">
                {(data.vendors || []).map(vendor => (
                  <div key={vendor.id} className="approval-item">
                    <div className="approval-info">
                      <strong>{vendor.companyName}</strong>
                      <span>{vendor.enabled === false ? 'Disabled' : vendor.status}</span>
                    </div>
                  </div>
                ))}
                {(data.vendors || []).length === 0 && (
                  <div className="approval-item"><div className="approval-info"><span>No approved vendors assigned</span></div></div>
                )}
              </div>
            </div>
          </div>
        )}
        {isVendor && (
          <div className="col-6">
            <div className="card">
              <h3>Account</h3>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12, color:'#666' }}>Change your password</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setPwModal(true)}>Change Password</button>
              </div>
            </div>
          </div>
        )}
        {/* Top Products (compact table) */}
        <div className="col-6">
          <div className="card">
            <h3>Top Selling Products</h3>
            <div className="top-products">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {isVendor
                    ? (Array.isArray(data.vendorTopProducts) ? data.vendorTopProducts : []).map((p, idx) => {
                        const imageSrc = p.image || '/default-product.png';
                        const formattedAvg = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(Number(p.avgPrice || 0));
                        return (
                          <tr key={`${p.name}-${idx}`}>
                            <td>
                              <div className="cell-product">
                                <img src={imageSrc} alt={p.name} className="product-thumb" onError={(e) => { e.currentTarget.src = '/default-product.png'; }} />
                                <span className="truncate" title={p.name}>{p.name}</span>
                              </div>
                            </td>
                            <td className="text-right">{formattedAvg}</td>
                            <td className="text-right">{p.stock ?? '-'}</td>
                          </tr>
                        );
                      })
                    : (Array.isArray(topProducts) ? topProducts : (Array.isArray(data.products) ? data.products : [])).map((product) => {
                        const imageSrc = (Array.isArray(product.images) && product.images[0]) || '/default-product.png';
                        const price = product.specialPrice ?? product.price ?? product.regularPrice ?? 0;
                        const formattedPrice = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(Number(price));
                        return (
                          <tr key={product.id || product._id}>
                            <td>
                              <div className="cell-product">
                                <img src={imageSrc} alt={product.name} className="product-thumb" onError={(e) => { e.currentTarget.src = '/default-product.png'; }} />
                                <span className="truncate" title={product.name}>{product.name}</span>
                              </div>
                            </td>
                            <td className="text-right">{formattedPrice}</td>
                            <td className="text-right">{product.stock ?? '-'}</td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        
      </div>
    </div>
    {pwModal && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setPwModal(false)}>
        <div style={{ width:'90%', maxWidth:420, background:'#fff', borderRadius:8, overflow:'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:12, borderBottom:'1px solid #eee' }}>
            <h3 style={{ margin:0 }}>Change Password</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setPwModal(false)}>Close</button>
          </div>
          <div style={{ padding:12 }}>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:12, color:'#666' }}>Current Password</label>
              <input type="password" className="filter-input" value={pwForm.currentPassword} onChange={e => setPwForm(prev => ({ ...prev, currentPassword: e.target.value }))} />
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:12, color:'#666' }}>New Password</label>
              <input type="password" className="filter-input" value={pwForm.newPassword} onChange={e => setPwForm(prev => ({ ...prev, newPassword: e.target.value }))} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:'#666' }}>Confirm New Password</label>
              <input type="password" className="filter-input" value={pwForm.confirmPassword} onChange={e => setPwForm(prev => ({ ...prev, confirmPassword: e.target.value }))} />
            </div>
            <button className="btn btn-primary" disabled={pwSubmitting} onClick={async () => {
              try {
                if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) { alert('All fields are required'); return; }
                if (pwForm.newPassword !== pwForm.confirmPassword) { alert('New passwords do not match'); return; }
                if (pwForm.newPassword.length < 8) { alert('New password must be at least 8 characters'); return; }
                setPwSubmitting(true);
                const token = localStorage.getItem('adminToken');
                const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
                const BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || ''));
                const res = await fetch(`${BASE}/api/v1/auth/change-password`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }) });
                const j = await res.json().catch(() => ({}));
                if (!res.ok || !j?.success) throw new Error(j?.message || 'Failed to change password');
                alert('Password changed successfully');
                setPwModal(false);
                setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
              } catch (e) { alert(e?.message || 'Failed to change password'); }
              finally { setPwSubmitting(false); }
            }}>{pwSubmitting ? 'Updating...' : 'Update Password'}</button>
          </div>
        </div>
      </div>
    )}
    {showOrderModal && selectedOrder && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeOrderDetails}>
        <div style={{ width: '90%', maxWidth: 560, maxHeight: '80vh', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
            <h3 style={{ margin: 0 }}>Order #{selectedOrder.orderNumber || selectedOrder.id}</h3>
            <button className="btn btn-secondary btn-sm" onClick={closeOrderDetails}>Close</button>
          </div>
          <div style={{ padding: 12, flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
              <span className={`badge badge-${selectedOrder.status === 'delivered' ? 'success' : selectedOrder.status === 'shipped' ? 'info' : 'warning'}`}>{selectedOrder.status}</span>
              <span style={{ color: '#666' }}>{selectedOrder.createdAt ? require('../../utils/date').formatDateTime(selectedOrder.createdAt) : ''}</span>
            </div>
            {/* Customer Details - hide for vendor users */}
            {!isVendor && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '8px 0' }}>Customer Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Name</div>
                    <div style={{ fontWeight: 600 }}>{(selectedOrder.user && (selectedOrder.user.name || selectedOrder.user.email)) || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Email</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrder.user?.email || selectedOrder.customerEmail || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Phone</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrder.customerPhone || selectedOrder.user?.phone || 'N/A'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Address</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrder.shippingAddress || 'N/A'}</div>
                  </div>
                </div>
              </div>
            )}
            <div>
              {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map((it, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f2f2f2' }}>
                  <img src={it.image || '/default-product.png'} alt={it.name} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', marginRight: 10 }} onError={(e) => { e.currentTarget.src = '/default-product.png'; }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>Qty: {it.quantity} • Price: ₹{Number((it.vendorDisplayUnitPrice ?? it.vendorUnitPrice ?? it.price) || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ fontWeight: 600 }}>₹{Number(((it.vendorDisplayUnitPrice ?? it.vendorUnitPrice ?? it.price) || 0) * Number(it.quantity || 0)).toFixed(2)}</div>
                  </div>
                ))}
                    </div>
            {/* Order Summary (hide for vendor admins) */}
            {!isVendor && (
            <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Order Summary</h4>
              {(() => {
                try {
                  const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
                  const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
                  const taxPercent = Number(selectedOrder.tax || 0);
                  const taxAmount = (subtotal * taxPercent) / 100;
                  const shipping = Number(selectedOrder.shippingCost || 0);
                  const discount = Number(selectedOrder.discountAmount || 0);
                  const total = Math.max(0, subtotal + taxAmount + shipping - discount);
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6 }}>
                      {selectedOrder.couponCode && (
                        <>
                          <div style={{ color: '#666' }}>Coupon</div>
                          <div style={{ fontWeight: 600 }}>{String(selectedOrder.couponCode).toUpperCase()}</div>
                        </>
                      )}
                      <div style={{ color: '#666' }}>Subtotal</div>
                      <div style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</div>
                      <div style={{ color: '#666' }}>Tax ({taxPercent}%)</div>
                      <div style={{ fontWeight: 600 }}>{formatCurrency(taxAmount)}</div>
                      <div style={{ color: '#666' }}>Shipping</div>
                      <div style={{ fontWeight: 600 }}>{formatCurrency(shipping)}</div>
                      {discount > 0 && (
                        <>
                          <div style={{ color: '#666' }}>Discount</div>
                          <div style={{ fontWeight: 600 }}>- {formatCurrency(discount)}</div>
                        </>
                      )}
                      <div style={{ color: '#333', marginTop: 4 }}>Total</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{formatCurrency(total)}</div>
                    </div>
                  );
                } catch (_) { return null; }
              })()}
            </div>
            )}
          </div>
          {/* Footer bar keeps total always visible */}
          <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 16, background: '#fff' }}>
            {(() => {
              try {
                if (isVendor) {
                  const totalV = Number(selectedOrder.vendorSubtotal || 0);
                  return (<><div style={{ color: '#333' }}>Total:</div><div style={{ fontWeight: 700 }}>{formatCurrency(totalV)}</div></>);
                }
                const total = (selectedOrder.total != null) ? Number(selectedOrder.total) : (() => {
                  const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
                  const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
                  const taxPercent = Number(selectedOrder.tax || 0);
                  const taxAmount = (subtotal * taxPercent) / 100;
                  const shipping = Number(selectedOrder.shippingCost || 0);
                  const discount = Number(selectedOrder.discountAmount || 0);
                  return Math.max(0, subtotal + taxAmount + shipping - discount);
                })();
                return (<><div style={{ color: '#333' }}>Total:</div><div style={{ fontWeight: 700 }}>{formatCurrency(total)}</div></>);
              } catch (_) { return null; }
            })()}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Dashboard; 
