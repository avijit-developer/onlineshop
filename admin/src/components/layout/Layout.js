import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Layout = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [realTimePermissions, setRealTimePermissions] = useState(new Set());
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const location = useLocation();

  const isVendor = user?.role === 'vendor';

  // Fetch real-time permissions for vendor users on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!isVendor) return;
      try {
        setLoadingPermissions(true);
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${API_BASE}/api/v1/auth/current-permissions`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const data = await res.json();
          const perms = new Set(data.permissions || []);
          setRealTimePermissions(perms);
          // Also update persisted user to keep consistency
          const savedUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
          const updatedUser = { ...savedUser, permissions: Array.from(perms) };
          localStorage.setItem('adminUser', JSON.stringify(updatedUser));
        }
      } catch (e) {
        // ignore
      } finally {
        setLoadingPermissions(false);
      }
    };
    fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simple approach: Use stored permissions and refresh when needed
  const userPerms = isVendor && realTimePermissions.size > 0
    ? realTimePermissions
    : new Set((user?.permissions || []));
  const marketplaceMenu = !isVendor ? [
    { path: '/coupons', label: 'Coupon', icon: '🎁' },
    { path: '/banners', label: 'Banner', icon: '🖼️' },
    { path: '/reviews', label: 'Review', icon: '⭐' },
    { path: '/homepage', label: 'Home page', icon: '🏠' },
  ] : [];

  const allMenuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    !isVendor && { path: '/customers', label: 'Customers', icon: '👥' },
    !isVendor && { path: '/admin-users', label: 'Admin Users', icon: '👤' },
    (!isVendor || userPerms.has('vendor.view') || userPerms.has('vendor.edit')) && { path: '/vendors', label: 'Vendors', icon: '🏪' },
    (!isVendor || userPerms.has('products.view')) && { path: '/products', label: 'Products', icon: '📦' },
    !isVendor && { path: '/categories', label: 'Categories', icon: '📁' },
    !isVendor && { path: '/brands', label: 'Brands', icon: '🏷️' },
    (!isVendor || userPerms.has('orders.view')) && { path: '/orders', label: 'Orders', icon: '🛒' },
    !isVendor && { path: '/inventory', label: 'Inventory', icon: '📋' },
    !isVendor && { path: '/payments', label: 'Payments', icon: '💰' },
    // Marketplace collapsible placeholder marker
    !isVendor && { path: '#marketplace', label: 'Marketplace', icon: '🛍️', children: marketplaceMenu },
    !isVendor && { path: '/settings', label: 'Settings', icon: '⚙️' },
  ].filter(Boolean);

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>{isVendor ? 'Vendor Panel' : 'Admin Panel'}</h2>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {allMenuItems.map((item) => {
            if (item.children && item.children.length > 0) {
              return (
                <div key={item.label} className="nav-group">
                  <div className="nav-item nav-group-header">
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </div>
                  <div className="nav-group-children">
                    {item.children.map(child => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`nav-item ${isActive(child.path) ? 'active' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className="nav-icon">{child.icon}</span>
                        <span className="nav-label">{child.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button 
              className="menu-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <h1>{allMenuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}</h1>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              <span>Welcome, {user?.name}</span>
              <span className="user-role">({user?.role}{user?.role==='vendor' && user?.vendorCompany ? ` • ${user.vendorCompany}`:''})</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout; 