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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('adminToken');
    const userData = localStorage.getItem('adminUser');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
    setLoading(false);
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
          <Route 
            path="/admin" 
            element={<Navigate to="/login" replace />} 
          />
          <Route 
            path="/login" 
            element={
              !isAuthenticated ? (
                <Login onLogin={login} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              !isAuthenticated ? (
                <ForgotPassword />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            } 
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Dashboard />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/customers" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Customers />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/admin-users" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <AdminUsers />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/vendors" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Vendors />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/products" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Products />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/categories" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Categories />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/brands" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Brands />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/orders" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Orders />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/inventory" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Inventory />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/payments" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Payments />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/coupons" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Coupons />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/banners" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Banners />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/homepage" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <HomePageManager />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/reviews" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Reviews />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/settings" 
            element={
              isAuthenticated ? (
                <Layout user={user} onLogout={logout}>
                  <Settings />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 