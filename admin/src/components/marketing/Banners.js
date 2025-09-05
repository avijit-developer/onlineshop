import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import './Banners.css';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: '',
    linkText: '',
    position: 1,
    startDate: '',
    endDate: '',
    isActive: true,
    targetType: 'none',
    targetId: ''
  });

  useEffect(() => {
    fetchBanners();
    // Preload categories/products for dropdowns
    (async () => {
      try {
        const [catsRes, prodsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/categories/public?parent=all&limit=1000`).then(r => r.json()).catch(() => ({})),
          fetch(`${API_BASE}/api/v1/products?q=&page=1&limit=200`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({}))
        ]);
        window.__bannerCategories = (catsRes?.data || []).map(c => ({ _id: c._id || c.id, name: c.name }));
        window.__bannerProducts = (prodsRes?.data || []).map(p => ({ _id: p._id || p.id, name: p.name }));
      } catch (_) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const authHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/banners?page=1&limit=100`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load banners');
      setBanners(json.data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const generateSampleBanners = () => {
    return [
      {
        id: 1,
        title: 'Summer Sale',
        description: 'Get up to 50% off on summer collection',
        imageUrl: 'https://via.placeholder.com/800x400/FF6B6B/FFFFFF?text=Summer+Sale',
        linkUrl: '/category/summer',
        linkText: 'Shop Now',
        position: 1,
        startDate: '2024-06-01',
        endDate: '2024-08-31',
        isActive: true,
        targetType: 'category',
        targetId: 'summer',
        createdAt: '2024-01-01T00:00:00Z',
        views: 1250,
        clicks: 89
      },
      {
        id: 2,
        title: 'New Electronics',
        description: 'Latest gadgets and electronics',
        imageUrl: 'https://via.placeholder.com/800x400/4ECDC4/FFFFFF?text=New+Electronics',
        linkUrl: '/category/electronics',
        linkText: 'Explore',
        position: 2,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
        targetType: 'category',
        targetId: 'electronics',
        createdAt: '2024-01-15T00:00:00Z',
        views: 2100,
        clicks: 156
      },
      {
        id: 3,
        title: 'Free Shipping',
        description: 'Free shipping on orders over $50',
        imageUrl: 'https://via.placeholder.com/800x400/45B7D1/FFFFFF?text=Free+Shipping',
        linkUrl: '/shipping-info',
        linkText: 'Learn More',
        position: 3,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: false,
        targetType: 'page',
        targetId: 'shipping',
        createdAt: '2024-02-01T00:00:00Z',
        views: 890,
        clicks: 45
      }
    ];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.imageUrl) {
        toast.error('Please upload an image');
        return;
      }
      const payload = {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.targetType === 'page' ? formData.linkUrl : '',
        linkText: formData.linkText,
        position: formData.position,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: formData.isActive,
        targetType: formData.targetType,
        targetId: formData.targetId,
        imagePublicId: formData.imagePublicId || ''
      };
      if (editingBanner) {
        const res = await fetch(`${API_BASE}/api/v1/banners/${editingBanner._id || editingBanner.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to update banner');
        toast.success('Banner updated successfully');
      } else {
        const res = await fetch(`${API_BASE}/api/v1/banners`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to create banner');
        toast.success('Banner created successfully');
      }
      setShowModal(false);
      setEditingBanner(null);
      resetForm();
      fetchBanners();
    } catch (err) {
      toast.error(err.message || 'Failed to save banner');
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      description: banner.description || '',
      imageUrl: banner.image || banner.imageUrl || '',
      imagePublicId: banner.imagePublicId || '',
      linkUrl: banner.linkUrl || '',
      linkText: banner.linkText || '',
      position: banner.position || 1,
      startDate: banner.startDate ? banner.startDate.substring(0,10) : '',
      endDate: banner.endDate ? banner.endDate.substring(0,10) : '',
      isActive: !!banner.isActive,
      targetType: banner.targetType || 'none',
      targetId: banner.targetId || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (bannerId) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/banners/${bannerId}`, { method: 'DELETE', headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete banner');
      toast.success('Banner deleted successfully');
      fetchBanners();
    } catch (err) {
      toast.error(err.message || 'Failed to delete banner');
    }
  };

  const handleToggleStatus = async (banner, newIsActive) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/banners/${banner._id || banner.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !!newIsActive })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update banner');
      toast.success('Banner status updated');
      fetchBanners();
    } catch (err) {
      toast.error(err.message || 'Failed to update banner');
    }
  };

  const getUploadSignature = async () => {
    const res = await fetch(`${API_BASE}/api/v1/uploads/signature`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ folder: 'banners' })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to get upload signature');
    return json.data;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { signature, timestamp, folder, apiKey, cloudName } = await getUploadSignature();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', apiKey);
      fd.append('timestamp', String(timestamp));
      fd.append('signature', signature);
      fd.append('folder', folder);
      fd.append('unique_filename', 'true');
      fd.append('overwrite', 'false');
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Cloudinary upload failed');
      setFormData(prev => ({ ...prev, imageUrl: json.secure_url, imagePublicId: json.public_id }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      linkUrl: '',
      linkText: '',
      position: 1,
      startDate: '',
      endDate: '',
      isActive: true,
      targetType: 'none',
      targetId: ''
    });
  };

  const getFilteredBanners = () => {
    let filtered = banners;
    
    if (searchTerm) {
      filtered = filtered.filter(banner => 
        banner.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        banner.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(banner => 
        filterStatus === 'active' ? banner.isActive : !banner.isActive
      );
    }
    
    return filtered;
  };

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getFilteredBanners().length / itemsPerPage);

  const getStatusBadgeClass = (isActive, endDate) => {
    if (!isActive) return 'status-inactive';
    if (new Date(endDate) < new Date()) return 'status-expired';
    return 'status-active';
  };

  const getStatusText = (isActive, endDate) => {
    if (!isActive) return 'Inactive';
    if (new Date(endDate) < new Date()) return 'Expired';
    return 'Active';
  };

  const getCTR = (views, clicks) => {
    if (views === 0) return '0%';
    return `${((clicks / views) * 100).toFixed(2)}%`;
  };

  if (loading) {
    return <div className="loading">Loading banners...</div>;
  }

  return (
    <div className="banners-container">
      <div className="page-header">
        <h1>Banner Management</h1>
        <div className="header-actions">
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Add New Banner
          </button>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Banners</h3>
          <p>{banners.length}</p>
        </div>
        <div className="stat-card">
          <h3>Active Banners</h3>
          <p>{banners.filter(b => b.isActive && new Date(b.endDate) >= new Date()).length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Views</h3>
          <p>{banners.reduce((sum, b) => sum + b.views, 0).toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Total Clicks</h3>
          <p>{banners.reduce((sum, b) => sum + b.clicks, 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="filter-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by banner title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-options">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="banners-grid">
        {getPaginatedData(getFilteredBanners()).map((banner) => (
          <div key={banner.id} className="banner-card">
            <div className="banner-image">
              <img src={banner.image || banner.imageUrl} alt={banner.title} />
              <div className="banner-overlay">
                <div className="banner-actions">
                  <button
                    onClick={() => handleEdit(banner)}
                    className="btn btn-info btn-sm"
                  >
                    Edit
                  </button>
                  <label className="toggle-switch" title={banner.isActive ? 'Enabled' : 'Disabled'}>
                    <input type="checkbox" checked={!!banner.isActive} onChange={(e) => handleToggleStatus(banner, e.target.checked)} />
                    <span className="slider" />
                  </label>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="banner-position">
                Position: {banner.position}
              </div>
            </div>
            <div className="banner-content">
              <h3>{banner.title}</h3>
              <p>{banner.description}</p>
              <div className="banner-meta">
                <div className="banner-stats">
                  <span>👁️ {banner.views.toLocaleString()}</span>
                  <span>🖱️ {banner.clicks.toLocaleString()}</span>
                  <span>📊 {getCTR(banner.views, banner.clicks)}</span>
                </div>
                <div className="banner-dates">
                  <p>From: {new Date(banner.startDate).toLocaleDateString()}</p>
                  <p>To: {new Date(banner.endDate).toLocaleDateString()}</p>
                </div>
                <div className="banner-link">
                  <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer">
                    {banner.linkText} →
                  </a>
                </div>
                <span className={`status-badge ${getStatusBadgeClass(banner.isActive, banner.endDate)}`}>
                  {getStatusText(banner.isActive, banner.endDate)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Add/Edit Banner Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingBanner ? 'Edit Banner' : 'Add New Banner'}</h2>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingBanner(null);
                  resetForm();
                }} 
                className="close-btn"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Banner Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="e.g., Summer Sale"
                  />
                </div>
                <div className="form-group">
                  <label>Position *</label>
                  <input
                    type="number"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: parseInt(e.target.value)})}
                    required
                    min="1"
                    placeholder="1"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Banner description..."
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>Image Upload *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    Upload Image
                  </button>
                  {formData.imageUrl && (
                    <div className="image-preview">
                      <img src={formData.imageUrl} alt="Preview" />
                    </div>
                  )}
                </div>
                {/* Link URL removed for non-page; show only when page selected */}
                {formData.targetType === 'page' && (
                  <div className="form-group">
                    <label>Page Link (URL)</label>
                    <input
                      type="url"
                      value={formData.linkUrl}
                      onChange={(e) => setFormData({...formData, linkUrl: e.target.value})}
                      placeholder="https://example.com/page"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Link Text</label>
                  <input
                    type="text"
                    value={formData.linkText}
                    onChange={(e) => setFormData({...formData, linkText: e.target.value})}
                    placeholder="e.g., Shop Now"
                  />
                </div>
                <div className="form-group">
                  <label>Target Type</label>
                  <select
                    value={formData.targetType}
                    onChange={(e) => setFormData({...formData, targetType: e.target.value, targetId: '', linkUrl: ''})}
                  >
                    <option value="none">None</option>
                    <option value="category">Category</option>
                    <option value="product">Product</option>
                    <option value="page">Page</option>
                  </select>
                </div>
                {/* Conditional target pickers */}
                {formData.targetType === 'category' && (
                  <div className="form-group">
                    <label>Select Category</label>
                    <select
                      value={formData.targetId}
                      onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                    >
                      <option value="">-- Select Category --</option>
                      {(window.__bannerCategories || []).map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {formData.targetType === 'product' && (
                  <div className="form-group">
                    <label>Select Product</label>
                    <select
                      value={formData.targetId}
                      onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                    >
                      <option value="">-- Select Product --</option>
                      {(window.__bannerProducts || []).map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    <label htmlFor="isActive">Active</label>
                  </div>
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingBanner(null);
                  resetForm();
                }} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn btn-primary">
                {editingBanner ? 'Update Banner' : 'Create Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banners; 