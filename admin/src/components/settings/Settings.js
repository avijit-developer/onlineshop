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
            {/* Email and Payment sections removed */}
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
                  
                  {/* Site Logo and Favicon removed (integrate with API) */}
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
                  {/* Timezone removed (integrate with API) */}
                  
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
                  
                  {/* Language removed (integrate with API) */}
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

          {/* Email Settings removed */}

          {/* Payment Settings removed */}

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
                
                {/* Shipping Zones removed (integrate with API) */}
                
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

          {/* Vendor Settings removed */}
        </div>
      </div>
    </div>
  );
};

export default Settings; 