import React, { useState, useEffect } from 'react';
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
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('adminUser') || 'null'); } catch { return null; }
  })();
  const isVendor = currentUser?.role === 'vendor';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
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
          const vendorSubtotalSum = sum(vendorOrders, o => o.vendorSubtotal);
          const vendorCommissionSum = sum(vendorOrders, o => (o.vendorCommission != null ? o.vendorCommission : 0));
          const vendorNetSum = sum(vendorOrders, o => (o.vendorNet != null ? o.vendorNet : (Number(o.vendorSubtotal || 0) - Number(o.vendorCommission || 0))));
          const vendorSummary = { ordersCount: vendorOrders.length, subtotal: vendorSubtotalSum, commission: vendorCommissionSum, net: vendorNetSum };
          // Sales data
          const daily = Array(7).fill(0); const weekly = Array(7).fill(0); const monthly = Array(7).fill(0);
          const now = new Date(); const msPerDay = 24*60*60*1000;
          const revenueOf = (o) => Number(o.vendorSubtotal || 0);
          for (const o of vendorOrders) {
            const dt = o.createdAt ? new Date(o.createdAt) : null; if (!dt || isNaN(dt.getTime())) continue;
            const dow = dt.getDay(); const monIdx = (dow + 6) % 7; daily[monIdx] += revenueOf(o);
            const diffDays = Math.floor((now - dt) / msPerDay); const weeksAgo = Math.min(6, Math.max(0, Math.floor(diffDays / 7))); weekly[6 - weeksAgo] += revenueOf(o);
            const monthDiff = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth()); const clamped = Math.min(6, Math.max(0, monthDiff)); monthly[6 - clamped] += revenueOf(o);
          }
          const vendorSalesData = { daily, weekly, monthly };
          // Top products
          const productAgg = new Map();
          for (const o of vendorOrders) {
            const items = Array.isArray(o.items) ? o.items : [];
            for (const it of items) {
              const key = String(it.product || it.sku || it.name || Math.random());
              const prev = productAgg.get(key) || { name: it.name, image: it.image, revenue: 0, quantity: 0 };
              const unit = (it.vendorDisplayUnitPrice != null) ? Number(it.vendorDisplayUnitPrice) : (it.vendorUnitPrice != null ? Number(it.vendorUnitPrice) : Number(it.price || 0));
              const qty = Number(it.quantity || 0);
              prev.revenue += unit * qty; prev.quantity += qty; prev.name = it.name || prev.name; prev.image = it.image || prev.image;
              productAgg.set(key, prev);
            }
          }
          const vendorTopProducts = Array.from(productAgg.values()).sort((a,b)=>b.revenue-a.revenue).slice(0,7).map(p=>({ name:p.name, image:p.image, avgPrice: p.quantity>0 ? (p.revenue/p.quantity):0, quantity:p.quantity, revenue:p.revenue }));

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
                  const vendorSubtotalSum = sum(vendorOrders, o => o.vendorSubtotal);
                  const vendorCommissionSum = sum(vendorOrders, o => (o.vendorCommission != null ? o.vendorCommission : 0));
                  const vendorNetSum = sum(vendorOrders, o => (o.vendorNet != null ? o.vendorNet : (Number(o.vendorSubtotal || 0) - Number(o.vendorCommission || 0))));
                  vendorSummary = {
                    ordersCount: vendorOrders.length,
                    subtotal: vendorSubtotalSum,
                    commission: vendorCommissionSum,
                    net: vendorNetSum,
                  };
                  // Build vendor sales series
                  const daily = Array(7).fill(0); // Mon..Sun
                  const weekly = Array(7).fill(0); // last 7 weeks
                  const monthly = Array(7).fill(0); // last 7 months
                  const now = new Date();
                  const msPerDay = 24 * 60 * 60 * 1000;
                  const revenueOf = (o) => Number(o.vendorSubtotal || 0);
                  for (const o of vendorOrders) {
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
                      const key = String(it.product || it.sku || it.name || Math.random());
                      const prev = productAgg.get(key) || { name: it.name, image: it.image, revenue: 0, quantity: 0 };
                      const unit = (it.vendorDisplayUnitPrice != null) ? Number(it.vendorDisplayUnitPrice) : (it.vendorUnitPrice != null ? Number(it.vendorUnitPrice) : Number(it.price || 0));
                      const qty = Number(it.quantity || 0);
                      prev.revenue += unit * qty;
                      prev.quantity += qty;
                      prev.name = it.name || prev.name;
                      prev.image = it.image || prev.image;
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
                    }));
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
      setLoading(false);
    }
  };

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
  const vendorSummary = data.vendorSummary || { ordersCount: 0, subtotal: 0, commission: 0, net: 0 };

  return (
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
              <p>Orders</p>
            </div>
            <div className="stat-card">
              <h3>₹{vendorSummary.net.toFixed(2)}</h3>
              <p>Net After Commission</p>
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
                <p>Pending Approvals</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="row">
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
                (data.vendorOrders || []).map((order) => (
                  <div key={order.id} className="order-item">
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
                  <div key={order._id || order.id} className="order-item">
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
        {/* Top Products (compact table) */}
        <div className="col-6">
          <div className="card">
            <h3>Top Selling Products</h3>
            <div className="top-products">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">{isVendor ? 'Avg Price' : 'Price'}</th>
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
                            <td className="text-right">-</td>
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

        {/* Pending Approvals (hidden for vendor users) */}
        {!isVendor && (
          <div className="col-6">
            <div className="card">
              <h3>Pending Approvals</h3>
              <div className="pending-approvals">
                {(data.vendors || []).filter(v => v.status === 'pending').length === 0 &&
                 (data.products || []).filter(p => p.status === 'pending').length === 0 && (
                  <div className="approval-item"><div className="approval-info"><span>No pending approvals</span></div></div>
                )}

                {/* Pending Vendors */}
                {(data.vendors || []).filter(v => v.status === 'pending').map(vendor => (
                  <div key={vendor.id} className="approval-item">
                    <div className="approval-info">
                      <strong>{vendor.companyName}</strong>
                      <span>Vendor Application</span>
                    </div>
                    <div className="approval-actions">
                      <button className="btn btn-success btn-sm">Approve</button>
                      <button className="btn btn-danger btn-sm">Reject</button>
                    </div>
                  </div>
                ))}
                
                {/* Pending Products */}
                {(data.products || []).filter(p => p.status === 'pending').map(product => (
                  <div key={product.id} className="approval-item">
                    <div className="approval-info">
                      <strong>{product.name}</strong>
                      <span>Product Approval</span>
                    </div>
                    <div className="approval-actions">
                      <button className="btn btn-success btn-sm">Approve</button>
                      <button className="btn btn-danger btn-sm">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 