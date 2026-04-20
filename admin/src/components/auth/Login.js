import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Login.css';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
const REMEMBERED_CREDENTIALS_KEY = 'adminRememberedCredentials';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const rememberedCredentials = (() => {
    if (typeof window === 'undefined') return { phone: '', password: '' };
    try {
      const parsed = JSON.parse(localStorage.getItem(REMEMBERED_CREDENTIALS_KEY) || '{}');
      return {
        phone: parsed?.phone || '',
        password: parsed?.password || '',
      };
    } catch (_) {
      return { phone: '', password: '' };
    }
  })();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      phone: rememberedCredentials.phone,
      password: rememberedCredentials.password,
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone, password: data.password })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = json?.message || 'Login failed';
        toast.error(message);
        return;
      }

      const { token, user } = json;
      if (!token || !user) {
        toast.error('Invalid response from server');
        return;
      }

      onLogin({ token, user });
      if (typeof window !== 'undefined') {
        localStorage.setItem(REMEMBERED_CREDENTIALS_KEY, JSON.stringify({
          phone: data.phone || '',
          password: data.password || '',
        }));
      }
      toast.success('Login successful!');
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
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              className={`form-control ${errors.phone ? 'error' : ''}`}
              placeholder="Enter your phone number"
              autoComplete="username"
              {...register('phone', {
                required: 'Phone number is required',
                pattern: {
                  value: /^[0-9+\-\s()]+$/,
                  message: 'Invalid phone number format'
                }
              })}
            />
            {errors.phone && <span className="error-message">{errors.phone.message}</span>}
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={`form-control ${errors.password ? 'error' : ''}`}
                placeholder="Enter your password"
                style={{ paddingRight: '40px' }}
                autoComplete="current-password"
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '5px 8px',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#667eea'}
                onMouseLeave={(e) => e.target.style.color = '#666'}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
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
            <Link to="/admin/forgot-password" className="forgot-link">
              Forgot your password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login; 
