import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Login.css';

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSubmitted(true);
      toast.success('Password reset link sent to your email!');
    } catch (error) {
      toast.error('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Check Your Email</h1>
            <p>We've sent a password reset link to your email address.</p>
          </div>
          
          <div className="text-center">
            <Link to="/login" className="btn btn-primary">
              Back to Login
            </Link>
          </div>
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
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
          
          <div className="login-footer">
            <Link to="/login" className="forgot-link">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword; 