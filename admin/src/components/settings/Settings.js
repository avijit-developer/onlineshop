import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Settings.css';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    general: {
      siteName: 'MultiVendor Store',
      siteDescription: 'Your trusted multi-vendor marketplace',
      siteLogo: '',
      favicon: '',
      contactEmail: 'admin@multivendor.com',
      contactPhone: '+1 (555) 123-4567',
      address: '123 Commerce St, Business City, BC 12345'
    },
    localization: {
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12',
      currency: 'USD',
      currencySymbol: '$',
      language: 'en',
      decimalPlaces: 2
    },
    email: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      smtpUsername: '',
      smtpPassword: '',
      fromEmail: 'noreply@multivendor.com',
      fromName: 'MultiVendor Store',
      emailVerification: true,
      orderNotifications: true,
      marketingEmails: false
    },
    payment: {
      stripeEnabled: true,
      stripePublishableKey: '',
      stripeSecretKey: '',
      paypalEnabled: true,
      paypalClientId: '',
      paypalSecret: '',
      commissionRate: 10,
      minimumPayout: 50
    },
    shipping: {
      freeShippingThreshold: 100,
      defaultShippingCost: 10,
      shippingZones: [
        { name: 'Local', cost: 5, countries: ['US'] },
        { name: 'International', cost: 25, countries: ['CA', 'MX', 'UK'] }
      ]
    },
    vendor: {
      autoApproval: false,
      commissionRate: 10,
      minimumBalance: 50,
      maxProducts: 1000,
      requireVerification: true,
      allowWithdrawals: true
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Simulate API call
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
      setLoading(false);
    }
  };

  const handleSave = async (category) => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`${category} settings saved successfully`);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleFileUpload = (field, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('general', field, e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure system settings and preferences</p>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            <button
              className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <span className="nav-icon">⚙️</span>
              General
            </button>
            <button
              className={`nav-item ${activeTab === 'localization' ? 'active' : ''}`}
              onClick={() => setActiveTab('localization')}
            >
              <span className="nav-icon">🌍</span>
              Localization
            </button>
            <button
              className={`nav-item ${activeTab === 'email' ? 'active' : ''}`}
              onClick={() => setActiveTab('email')}
            >
              <span className="nav-icon">📧</span>
              Email Settings
            </button>
            <button
              className={`nav-item ${activeTab === 'payment' ? 'active' : ''}`}
              onClick={() => setActiveTab('payment')}
            >
              <span className="nav-icon">💳</span>
              Payment Gateway
            </button>
            <button
              className={`nav-item ${activeTab === 'shipping' ? 'active' : ''}`}
              onClick={() => setActiveTab('shipping')}
            >
              <span className="nav-icon">🚚</span>
              Shipping
            </button>
            <button
              className={`nav-item ${activeTab === 'vendor' ? 'active' : ''}`}
              onClick={() => setActiveTab('vendor')}
            >
              <span className="nav-icon">🏪</span>
              Vendor Settings
            </button>
          </nav>
        </div>

        <div className="settings-content">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>General Settings</h2>
                <p>Configure basic site information and contact details</p>
              </div>
              
              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Site Name *</label>
                    <input
                      type="text"
                      value={settings.general.siteName}
                      onChange={(e) => handleInputChange('general', 'siteName', e.target.value)}
                      placeholder="Your Store Name"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Contact Email *</label>
                    <input
                      type="email"
                      value={settings.general.contactEmail}
                      onChange={(e) => handleInputChange('general', 'contactEmail', e.target.value)}
                      placeholder="admin@example.com"
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Site Description</label>
                    <textarea
                      value={settings.general.siteDescription}
                      onChange={(e) => handleInputChange('general', 'siteDescription', e.target.value)}
                      placeholder="Brief description of your store"
                      rows="3"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="tel"
                      value={settings.general.contactPhone}
                      onChange={(e) => handleInputChange('general', 'contactPhone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Business Address</label>
                    <textarea
                      value={settings.general.address}
                      onChange={(e) => handleInputChange('general', 'address', e.target.value)}
                      placeholder="Your business address"
                      rows="3"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Site Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('siteLogo', e)}
                      className="file-input"
                    />
                    {settings.general.siteLogo && (
                      <div className="image-preview">
                        <img src={settings.general.siteLogo} alt="Logo" />
                      </div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Favicon</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('favicon', e)}
                      className="file-input"
                    />
                    {settings.general.favicon && (
                      <div className="image-preview">
                        <img src={settings.general.favicon} alt="Favicon" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={() => handleSave('General')}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save General Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Localization Settings */}
          {activeTab === 'localization' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Localization Settings</h2>
                <p>Configure timezone, date format, currency, and language settings</p>
              </div>
              
              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Timezone *</label>
                    <select
                      value={settings.localization.timezone}
                      onChange={(e) => handleInputChange('localization', 'timezone', e.target.value)}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Date Format *</label>
                    <select
                      value={settings.localization.dateFormat}
                      onChange={(e) => handleInputChange('localization', 'dateFormat', e.target.value)}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Time Format *</label>
                    <select
                      value={settings.localization.timeFormat}
                      onChange={(e) => handleInputChange('localization', 'timeFormat', e.target.value)}
                    >
                      <option value="12">12-hour</option>
                      <option value="24">24-hour</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Currency *</label>
                    <select
                      value={settings.localization.currency}
                      onChange={(e) => handleInputChange('localization', 'currency', e.target.value)}
                    >
                      <option value="USD">US Dollar ($)</option>
                      <option value="EUR">Euro (€)</option>
                      <option value="GBP">British Pound (£)</option>
                      <option value="CAD">Canadian Dollar (C$)</option>
                      <option value="JPY">Japanese Yen (¥)</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Currency Symbol</label>
                    <input
                      type="text"
                      value={settings.localization.currencySymbol}
                      onChange={(e) => handleInputChange('localization', 'currencySymbol', e.target.value)}
                      placeholder="$"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Decimal Places</label>
                    <input
                      type="number"
                      value={settings.localization.decimalPlaces}
                      onChange={(e) => handleInputChange('localization', 'decimalPlaces', parseInt(e.target.value))}
                      min="0"
                      max="4"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Language *</label>
                    <select
                      value={settings.localization.language}
                      onChange={(e) => handleInputChange('localization', 'language', e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                      <option value="pt">Portuguese</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={() => handleSave('Localization')}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save Localization Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Email Settings</h2>
                <p>Configure SMTP settings and email preferences</p>
              </div>
              
              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>SMTP Host *</label>
                    <input
                      type="text"
                      value={settings.email.smtpHost}
                      onChange={(e) => handleInputChange('email', 'smtpHost', e.target.value)}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>SMTP Port *</label>
                    <input
                      type="number"
                      value={settings.email.smtpPort}
                      onChange={(e) => handleInputChange('email', 'smtpPort', e.target.value)}
                      placeholder="587"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>SMTP Username</label>
                    <input
                      type="text"
                      value={settings.email.smtpUsername}
                      onChange={(e) => handleInputChange('email', 'smtpUsername', e.target.value)}
                      placeholder="your-email@gmail.com"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>SMTP Password</label>
                    <input
                      type="password"
                      value={settings.email.smtpPassword}
                      onChange={(e) => handleInputChange('email', 'smtpPassword', e.target.value)}
                      placeholder="Your password"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>From Email *</label>
                    <input
                      type="email"
                      value={settings.email.fromEmail}
                      onChange={(e) => handleInputChange('email', 'fromEmail', e.target.value)}
                      placeholder="noreply@yourstore.com"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>From Name *</label>
                    <input
                      type="text"
                      value={settings.email.fromName}
                      onChange={(e) => handleInputChange('email', 'fromName', e.target.value)}
                      placeholder="Your Store Name"
                    />
                  </div>
                </div>
                
                <div className="email-preferences">
                  <h3>Email Preferences</h3>
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="emailVerification"
                      checked={settings.email.emailVerification}
                      onChange={(e) => handleInputChange('email', 'emailVerification', e.target.checked)}
                    />
                    <label htmlFor="emailVerification">Require email verification for new accounts</label>
                  </div>
                  
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="orderNotifications"
                      checked={settings.email.orderNotifications}
                      onChange={(e) => handleInputChange('email', 'orderNotifications', e.target.checked)}
                    />
                    <label htmlFor="orderNotifications">Send order notifications</label>
                  </div>
                  
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="marketingEmails"
                      checked={settings.email.marketingEmails}
                      onChange={(e) => handleInputChange('email', 'marketingEmails', e.target.checked)}
                    />
                    <label htmlFor="marketingEmails">Allow marketing emails</label>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={() => handleSave('Email')}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save Email Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Settings */}
          {activeTab === 'payment' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Payment Gateway Settings</h2>
                <p>Configure payment gateways and commission settings</p>
              </div>
              
              <div className="settings-form">
                <div className="payment-gateways">
                  <h3>Stripe Configuration</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Enable Stripe</label>
                      <div className="checkbox-group">
                        <input
                          type="checkbox"
                          id="stripeEnabled"
                          checked={settings.payment.stripeEnabled}
                          onChange={(e) => handleInputChange('payment', 'stripeEnabled', e.target.checked)}
                        />
                        <label htmlFor="stripeEnabled">Enable Stripe payments</label>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label>Publishable Key</label>
                      <input
                        type="text"
                        value={settings.payment.stripePublishableKey}
                        onChange={(e) => handleInputChange('payment', 'stripePublishableKey', e.target.value)}
                        placeholder="pk_test_..."
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Secret Key</label>
                      <input
                        type="password"
                        value={settings.payment.stripeSecretKey}
                        onChange={(e) => handleInputChange('payment', 'stripeSecretKey', e.target.value)}
                        placeholder="sk_test_..."
                      />
                    </div>
                  </div>
                  
                  <h3>PayPal Configuration</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Enable PayPal</label>
                      <div className="checkbox-group">
                        <input
                          type="checkbox"
                          id="paypalEnabled"
                          checked={settings.payment.paypalEnabled}
                          onChange={(e) => handleInputChange('payment', 'paypalEnabled', e.target.checked)}
                        />
                        <label htmlFor="paypalEnabled">Enable PayPal payments</label>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label>Client ID</label>
                      <input
                        type="text"
                        value={settings.payment.paypalClientId}
                        onChange={(e) => handleInputChange('payment', 'paypalClientId', e.target.value)}
                        placeholder="Your PayPal Client ID"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Secret</label>
                      <input
                        type="password"
                        value={settings.payment.paypalSecret}
                        onChange={(e) => handleInputChange('payment', 'paypalSecret', e.target.value)}
                        placeholder="Your PayPal Secret"
                      />
                    </div>
                  </div>
                  
                  <h3>Commission Settings</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Commission Rate (%)</label>
                      <input
                        type="number"
                        value={settings.payment.commissionRate}
                        onChange={(e) => handleInputChange('payment', 'commissionRate', parseFloat(e.target.value))}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Minimum Payout ($)</label>
                      <input
                        type="number"
                        value={settings.payment.minimumPayout}
                        onChange={(e) => handleInputChange('payment', 'minimumPayout', parseFloat(e.target.value))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={() => handleSave('Payment')}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save Payment Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Settings */}
          {activeTab === 'shipping' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Shipping Settings</h2>
                <p>Configure shipping zones and costs</p>
              </div>
              
              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Free Shipping Threshold ($)</label>
                    <input
                      type="number"
                      value={settings.shipping.freeShippingThreshold}
                      onChange={(e) => handleInputChange('shipping', 'freeShippingThreshold', parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Default Shipping Cost ($)</label>
                    <input
                      type="number"
                      value={settings.shipping.defaultShippingCost}
                      onChange={(e) => handleInputChange('shipping', 'defaultShippingCost', parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                
                <div className="shipping-zones">
                  <h3>Shipping Zones</h3>
                  <div className="zones-list">
                    {settings.shipping.shippingZones.map((zone, index) => (
                      <div key={index} className="zone-item">
                        <div className="zone-header">
                          <h4>{zone.name}</h4>
                          <span className="zone-cost">${zone.cost}</span>
                        </div>
                        <p className="zone-countries">Countries: {zone.countries.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={() => handleSave('Shipping')}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save Shipping Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Settings */}
          {activeTab === 'vendor' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Vendor Settings</h2>
                <p>Configure vendor registration and management settings</p>
              </div>
              
              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Auto-approve Vendors</label>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        id="autoApproval"
                        checked={settings.vendor.autoApproval}
                        onChange={(e) => handleInputChange('vendor', 'autoApproval', e.target.checked)}
                      />
                      <label htmlFor="autoApproval">Automatically approve new vendor registrations</label>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Require Verification</label>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        id="requireVerification"
                        checked={settings.vendor.requireVerification}
                        onChange={(e) => handleInputChange('vendor', 'requireVerification', e.target.checked)}
                      />
                      <label htmlFor="requireVerification">Require vendor verification documents</label>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Commission Rate (%)</label>
                    <input
                      type="number"
                      value={settings.vendor.commissionRate}
                      onChange={(e) => handleInputChange('vendor', 'commissionRate', parseFloat(e.target.value))}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Minimum Balance ($)</label>
                    <input
                      type="number"
                      value={settings.vendor.minimumBalance}
                      onChange={(e) => handleInputChange('vendor', 'minimumBalance', parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Max Products per Vendor</label>
                    <input
                      type="number"
                      value={settings.vendor.maxProducts}
                      onChange={(e) => handleInputChange('vendor', 'maxProducts', parseInt(e.target.value))}
                      min="1"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Allow Withdrawals</label>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        id="allowWithdrawals"
                        checked={settings.vendor.allowWithdrawals}
                        onChange={(e) => handleInputChange('vendor', 'allowWithdrawals', e.target.checked)}
                      />
                      <label htmlFor="allowWithdrawals">Allow vendors to request withdrawals</label>
                    </div>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={() => handleSave('Vendor')}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save Vendor Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 