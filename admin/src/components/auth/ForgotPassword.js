import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Login.css';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('email'); // email | otp
  const [email, setEmail] = useState('');
  const { register, handleSubmit, formState: { errors }, getValues } = useForm();

  const onSubmitEmail = async (data) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.message || 'Failed to send OTP');
        return;
      }
      setEmail(data.email);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (e) {
      toast.error('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitReset = async (data) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: data.otp, newPassword: data.newPassword })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.message || 'Failed to reset password');
        return;
      }
      toast.success('Password updated. Please login.');
      window.location.href = '/admin/login';
    } catch (e) {
      toast.error('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Verify OTP</h1>
            <p>Enter the 6-digit code sent to {email}</p>
          </div>
          <form onSubmit={handleSubmit(onSubmitReset)} className="login-form">
            <div className="form-group">
              <label className="form-label">OTP</label>
              <input
                type="text"
                className={`form-control ${errors.otp ? 'error' : ''}`}
                placeholder="Enter OTP"
                {...register('otp', { required: 'OTP is required', minLength: { value: 4, message: 'Enter valid code' } })}
              />
              {errors.otp && <span className="error-message">{errors.otp.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className={`form-control ${errors.newPassword ? 'error' : ''}`}
                placeholder="Enter new password"
                {...register('newPassword', { required: 'New password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
              />
              {errors.newPassword && <span className="error-message">{errors.newPassword.message}</span>}
            </div>

            <div className="form-group">
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>

            <div className="login-footer">
              <button type="button" className="forgot-link" onClick={() => setStep('email')}>Change email</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Forgot Password</h1>
          <p>Enter your email to reset your password</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmitEmail)} className="login-form">
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
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
          
          <div className="login-footer">
            <Link to="/admin/login" className="forgot-link">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword; 