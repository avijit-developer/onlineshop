import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const isVendor = user?.role === 'vendor';

  const userPerms = new Set((user?.permissions || []));
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
    !isVendor && { path: '/coupons', label: 'Coupons', icon: '🎁' },
    !isVendor && { path: '/banners', label: 'Banners', icon: '🖼️' },
    !isVendor && { path: '/reviews', label: 'Reviews', icon: '⭐' },
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
          {allMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
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