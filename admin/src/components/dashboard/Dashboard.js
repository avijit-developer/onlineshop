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
      try {
        const token = localStorage.getItem('adminToken');
        const resp = await fetch(process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/v1/admin/dashboard` : '/api/v1/admin/dashboard', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success) {
            let vendorsList = [];
            let vendorOrders = [];
            if (isVendor) {
              try {
                const vres = await fetch((process.env.REACT_APP_API_URL || '') + '/api/v1/vendors?page=1&limit=100', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
                if (vres.ok) {
                  const vjson = await vres.json();
                  vendorsList = (vjson?.data || []).map(v => ({ id: v._id || v.id, companyName: v.companyName, status: v.status, enabled: v.enabled }));
                }
                const ores = await fetch((process.env.REACT_APP_API_URL || '') + '/api/v1/orders/vendor?page=1&limit=5', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
                if (ores.ok) {
                  const ojson = await ores.json();
                  vendorOrders = ojson?.data || [];
                }
              } catch (_) {}
            }
            setData({ dashboard: json.data, orders: json.data.recentOrders, products: json.data.topProducts, vendors: vendorsList, vendorOrders, users: [] });
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
    const salesData = (data.dashboard && data.dashboard.salesData) ? data.dashboard.salesData : defaultSeries;

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

  return (
    <div className="dashboard">
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>${stats.totalSales.toLocaleString()}</h3>
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
        <div className="stat-card">
          <h3>{stats.lowStockProducts}</h3>
          <p>Low Stock Products</p>
        </div>
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
                      <span className="order-amount">${Number(order.vendorSubtotal || 0).toFixed(2)}</span>
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
                      <span className="order-amount">${Number(order.total || 0).toFixed(2)}</span>
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
        {/* Top Products */}
        <div className="col-6">
          <div className="card">
            <h3>Top Selling Products</h3>
            <div className="top-products">
              {(Array.isArray(topProducts) ? topProducts : (Array.isArray(data.products) ? data.products : [])).map((product) => (
                <div key={product.id || product._id} className="product-item">
                  <img src={(product.images && product.images[0]) || '/default-product.png'} alt={product.name} className="product-image" />
                  <div className="product-info">
                    <strong>{product.name}</strong>
                    <span>${product.specialPrice}</span>
                  </div>
                  <div className="product-stats">
                    <span>Stock: {product.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Approvals (hidden for vendor users) */}
        {!isVendor && (
          <div className="col-6">
            <div className="card">
              <h3>Pending Approvals</h3>
              <div className="pending-approvals">
                {/* Pending Vendors */}
                {data.vendors.filter(v => v.status === 'pending').map(vendor => (
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
                {data.products.filter(p => p.status === 'pending').map(product => (
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