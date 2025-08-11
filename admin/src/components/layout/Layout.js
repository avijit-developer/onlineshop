import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/customers', label: 'Customers', icon: '👥' },
    { path: '/admin-users', label: 'Admin Users', icon: '👤' },
    { path: '/vendors', label: 'Vendors', icon: '🏪' },
    { path: '/products', label: 'Products', icon: '📦' },
    { path: '/categories', label: 'Categories', icon: '📁' },
    { path: '/brands', label: 'Brands', icon: '🏷️' },
    { path: '/orders', label: 'Orders', icon: '🛒' },
    { path: '/inventory', label: 'Inventory', icon: '📋' },
    { path: '/payments', label: 'Payments', icon: '💰' },
    { path: '/coupons', label: 'Coupons', icon: '🎁' },
    { path: '/banners', label: 'Banners', icon: '🖼️' },
    { path: '/reviews', label: 'Reviews', icon: '⭐' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Admin Panel</h2>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
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
            <h1>{menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}</h1>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              <span>Welcome, {user?.name}</span>
              <span className="user-role">({user?.role})</span>
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