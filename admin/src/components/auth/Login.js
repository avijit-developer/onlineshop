import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Login.css';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Load data from JSON file
      const response = await fetch('/data.json');
      const jsonData = await response.json();
      
      // Find admin user
      const admin = jsonData.users.admins.find(
        admin => admin.email === data.email && admin.password === data.password
      );
      
      if (admin) {
        onLogin(admin);
        toast.success('Login successful!');
      } else {
        toast.error('Invalid email or password');
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Admin Panel</h1>
          <p>Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className={`form-control ${errors.email ? 'error' : ''}`}
              placeholder="Enter your email"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
            />
            {errors.email && <span className="error-message">{errors.email.message}</span>}
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className={`form-control ${errors.password ? 'error' : ''}`}
              placeholder="Enter your password"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
            />
            {errors.password && <span className="error-message">{errors.password.message}</span>}
          </div>
          
          <div className="form-group">
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
          
          <div className="login-footer">
            <Link to="/forgot-password" className="forgot-link">
              Forgot your password?
            </Link>
          </div>
        </form>
        
        <div className="demo-credentials">
          <h4>Demo Credentials:</h4>
          <p><strong>Admin:</strong> admin@example.com / admin123</p>
          <p><strong>Vendor Owner:</strong> vendor@example.com / vendor123</p>
        </div>
      </div>
    </div>
  );
};

export default Login; 