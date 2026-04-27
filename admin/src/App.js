import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './components/auth/Login';

import ForgotPassword from './components/auth/ForgotPassword';
import Dashboard from './components/dashboard/Dashboard';
import Layout from './components/layout/Layout';
import Customers from './components/users/Customers';
import AdminUsers from './components/users/AdminUsers';
import Vendors from './components/vendors/Vendors';
import Drivers from './components/drivers/Drivers';
import Products from './components/products/Products';
import Categories from './components/products/Categories';
import Brands from './components/products/Brands';
import Orders from './components/orders/Orders';
import Inventory from './components/inventory/Inventory';
import Payments from './components/payments/Payments';
import Coupons from './components/marketing/Coupons';
import Banners from './components/marketing/Banners';
import HomePageManager from './components/homepage/HomePageManager';
import Reviews from './components/reviews/Reviews';
import Settings from './components/settings/Settings';
import './App.css';
import { setLocalizationSettings } from './utils/date';
import { setCurrencySettings } from './utils/currency';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locVersion, setLocVersion] = useState(0);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('adminToken');
    const userData = localStorage.getItem('adminUser');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
      // Load localization settings once per session
      try {
        fetch(`${process.env.REACT_APP_API_URL || ''}/api/v1/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(j => {
          if (j?.success && j?.data?.localization) {
            setLocalizationSettings({
              dateFormat: j.data.localization.dateFormat,
              timeFormat: j.data.localization.timeFormat
            });
            setLocVersion(v => v + 1);
          }
          if (j?.success && j?.data?.localization) {
            setCurrencySettings({
              currency: j.data.localization.currency,
              currencySymbol: j.data.localization.currencySymbol,
              decimalPlaces: j.data.localization.decimalPlaces,
            });
          }
        }).catch(() => {});
      } catch (_) {}
    }
    setLoading(false);
  }, []);

  // Global fetch interceptor: redirect to login on 401 (expired/invalid token)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch;
    const isManagedApiRequest = (input) => {
      try {
        const rawUrl = typeof input === 'string'
          ? input
          : (input && input.url ? input.url : '');
        if (!rawUrl) return false;
        const resolvedUrl = new URL(rawUrl, window.location.origin);
        return resolvedUrl.pathname.startsWith('/api/v1/');
      } catch (_) {
        return false;
      }
    };
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      try {
        if (res && res.status === 401 && isManagedApiRequest(args[0])) {
          // Do not logout on expected 401s (e.g., wrong current password during change-password)
          try {
            const reqUrl = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
            if (reqUrl && reqUrl.includes('/api/v1/auth/change-password')) {
              return res; // allow caller to handle
            }
          } catch (_) {}
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          if (window.location.pathname !== '/admin/login') {
            window.location.replace('/admin/login');
          }
        }
      } catch (_) {}
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  const login = ({ token, user }) => {
    setIsAuthenticated(true);
    setUser(user);
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(user));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Toaster position="top-right" />
        <Routes>
          {/* root -> /admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* legacy redirects */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

          {/* admin base */}
          <Route 
            path="/admin" 
            element={
              isAuthenticated ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/admin/login" replace />
              )
            } 
          />
          <Route 
            path="/admin/login" 
            element={
              !isAuthenticated ? (
                <Login onLogin={login} />
              ) : (
                <Navigate to="/admin/dashboard" replace />
              )
            } 
          />
          <Route 
            path="/admin/forgot-password" 
            element={
              !isAuthenticated ? (
                <ForgotPassword />
              ) : (
                <Navigate to="/admin/dashboard" replace />
              )
            } 
          />
          <Route 
            path="/admin/dashboard" 
            element={
              isAuthenticated ? (
                <Layout key={locVersion} user={user} onLogout={logout}>
                  <Dashboard />
                </Layout>
              ) : (
                <Navigate to="/admin/login" replace />
              )
            } 
          />
          <Route path="/admin/customers" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Customers /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/admin-users" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><AdminUsers /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/vendors" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Vendors /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/drivers" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Drivers /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/products" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Products /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/categories" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Categories /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/brands" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Brands /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/orders" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Orders /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/inventory" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Inventory /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/payments" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Payments /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/coupons" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Coupons /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/banners" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Banners /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/homepage" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><HomePageManager /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/reviews" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Reviews /></Layout>) : (<Navigate to="/admin/login" replace />)} />
          <Route path="/admin/settings" element={isAuthenticated ? (<Layout key={locVersion} user={user} onLogout={logout}><Settings /></Layout>) : (<Navigate to="/admin/login" replace />)} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 
