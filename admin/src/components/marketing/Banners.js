import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Banners.css';

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);

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
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const fetchBanners = async () => {
    try {
      // Generate sample banners data
      const sampleBanners = generateSampleBanners();
      setBanners(sampleBanners);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Failed to load banners');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingBanner) {
      // Update existing banner
      const updatedBanners = banners.map(banner => 
        banner.id === editingBanner.id 
          ? { ...formData, id: editingBanner.id, createdAt: editingBanner.createdAt, views: editingBanner.views, clicks: editingBanner.clicks }
          : banner
      );
      setBanners(updatedBanners);
      toast.success('Banner updated successfully');
    } else {
      // Add new banner
      const newBanner = {
        ...formData,
        id: Date.now(),
        views: 0,
        clicks: 0,
        createdAt: new Date().toISOString()
      };
      setBanners([newBanner, ...banners]);
      toast.success('Banner created successfully');
    }
    
    setShowModal(false);
    setEditingBanner(null);
    resetForm();
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData(banner);
    setShowModal(true);
  };

  const handleDelete = (bannerId) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      const updatedBanners = banners.filter(banner => banner.id !== bannerId);
      setBanners(updatedBanners);
      toast.success('Banner deleted successfully');
    }
  };

  const handleToggleStatus = (bannerId) => {
    const updatedBanners = banners.map(banner => 
      banner.id === bannerId 
        ? { ...banner, isActive: !banner.isActive }
        : banner
    );
    setBanners(updatedBanners);
    toast.success('Banner status updated');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Simulate image upload
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData({...formData, imageUrl: e.target.result});
      };
      reader.readAsDataURL(file);
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
              <img src={banner.imageUrl} alt={banner.title} />
              <div className="banner-overlay">
                <div className="banner-actions">
                  <button
                    onClick={() => handleEdit(banner)}
                    className="btn btn-info btn-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(banner.id)}
                    className={`btn btn-sm ${banner.isActive ? 'btn-warning' : 'btn-success'}`}
                  >
                    {banner.isActive ? 'Deactivate' : 'Activate'}
                  </button>
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
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  {formData.imageUrl && (
                    <div className="image-preview">
                      <img src={formData.imageUrl} alt="Preview" />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Or Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="form-group">
                  <label>Link URL</label>
                  <input
                    type="url"
                    value={formData.linkUrl}
                    onChange={(e) => setFormData({...formData, linkUrl: e.target.value})}
                    placeholder="https://example.com"
                  />
                </div>
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
                    onChange={(e) => setFormData({...formData, targetType: e.target.value})}
                  >
                    <option value="none">None</option>
                    <option value="category">Category</option>
                    <option value="product">Product</option>
                    <option value="page">Page</option>
                  </select>
                </div>
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