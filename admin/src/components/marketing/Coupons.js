import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Coupons.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minimumAmount: '',
    maximumDiscount: '',
    usageLimit: '',
    usedCount: 0,
    startDate: '',
    endDate: '',
    isActive: true,
    appliesTo: 'all',
    vendorIds: [],
    categoryIds: [],
    productIds: []
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      if (filterStatus && filterStatus !== 'all') params.append('status', filterStatus);
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));

      const res = await fetch(`${API_BASE}/api/v1/coupons?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load coupons');
      setCoupons(json.data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      toast.error(error.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const generateSampleCoupons = () => {
    return [
      {
        id: 1,
        code: 'SAVE20',
        name: '20% Off All Products',
        description: 'Get 20% off on all products',
        discountType: 'percentage',
        discountValue: 20,
        minimumAmount: 50,
        maximumDiscount: 100,
        usageLimit: 100,
        usedCount: 45,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
        appliesTo: 'all',
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 2,
        code: 'FLAT10',
        name: '$10 Off Electronics',
        description: 'Get $10 off on electronics',
        discountType: 'fixed',
        discountValue: 10,
        minimumAmount: 100,
        maximumDiscount: 10,
        usageLimit: 50,
        usedCount: 23,
        startDate: '2024-01-15',
        endDate: '2024-06-30',
        isActive: true,
        appliesTo: 'category',
        categoryIds: [1, 2],
        createdAt: '2024-01-15T00:00:00Z'
      },
      {
        id: 3,
        code: 'WELCOME50',
        name: 'Welcome Discount',
        description: '50% off for new customers',
        discountType: 'percentage',
        discountValue: 50,
        minimumAmount: 25,
        maximumDiscount: 50,
        usageLimit: 200,
        usedCount: 189,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        isActive: false,
        appliesTo: 'all',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        minimumAmount: formData.minimumAmount !== '' ? Number(formData.minimumAmount) : undefined,
        maximumDiscount: formData.maximumDiscount !== '' ? Number(formData.maximumDiscount) : undefined,
        usageLimit: Number(formData.usageLimit) || 0,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: !!formData.isActive,
        appliesTo: formData.appliesTo,
        vendorIds: formData.vendorIds || [],
        categoryIds: formData.categoryIds || [],
        productIds: formData.productIds || []
      };

      if (editingCoupon) {
        const id = editingCoupon._id || editingCoupon.id;
        const res = await fetch(`${API_BASE}/api/v1/coupons/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to update coupon');
        toast.success('Coupon updated successfully');
      } else {
        const res = await fetch(`${API_BASE}/api/v1/coupons`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to create coupon');
        toast.success('Coupon created successfully');
      }
      setShowModal(false);
      setEditingCoupon(null);
      resetForm();
      await fetchCoupons();
    } catch (error) {
      toast.error(error.message || 'Failed to save coupon');
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData(coupon);
    setShowModal(true);
  };

  const handleDelete = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const id = couponId;
      const res = await fetch(`${API_BASE}/api/v1/coupons/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete coupon');
      toast.success('Coupon deleted successfully');
      await fetchCoupons();
    } catch (error) {
      toast.error(error.message || 'Failed to delete coupon');
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      const id = coupon._id || coupon.id;
      const res = await fetch(`${API_BASE}/api/v1/coupons/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update status');
      toast.success('Coupon status updated');
      await fetchCoupons();
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minimumAmount: '',
      maximumDiscount: '',
      usageLimit: '',
      usedCount: 0,
      startDate: '',
      endDate: '',
      isActive: true,
      appliesTo: 'all',
      vendorIds: [],
      categoryIds: [],
      productIds: []
    });
  };

  const getFilteredCoupons = () => {
    let filtered = coupons;
    
    if (searchTerm) {
      filtered = filtered.filter(coupon => 
        coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coupon.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(coupon => 
        filterStatus === 'active' ? coupon.isActive : !coupon.isActive
      );
    }
    
    return filtered;
  };

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getFilteredCoupons().length / itemsPerPage);

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

  if (loading) {
    return <div className="loading">Loading coupons...</div>;
  }

  return (
    <div className="coupons-container">
      <div className="page-header">
        <h1>Coupon Management</h1>
        <div className="header-actions">
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Add New Coupon
          </button>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Coupons</h3>
          <p>{coupons.length}</p>
        </div>
        <div className="stat-card">
          <h3>Active Coupons</h3>
          <p>{coupons.filter(c => c.isActive && new Date(c.endDate) >= new Date()).length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Usage</h3>
          <p>{coupons.reduce((sum, c) => sum + c.usedCount, 0)}</p>
        </div>
        <div className="stat-card">
          <h3>Expired Coupons</h3>
          <p>{coupons.filter(c => new Date(c.endDate) < new Date()).length}</p>
        </div>
      </div>

      <div className="filter-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by coupon code or name..."
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

      <div className="coupons-table-container">
        <table className="coupons-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Discount</th>
              <th>Usage</th>
              <th>Valid Period</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedData(getFilteredCoupons()).map((coupon) => (
              <tr key={coupon.id}>
                <td>
                  <div className="coupon-code">
                    <strong>{coupon.code}</strong>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                        toast.success('Coupon code copied!');
                      }}
                      className="copy-btn"
                      title="Copy code"
                    >
                      📋
                    </button>
                  </div>
                </td>
                <td>
                  <div className="coupon-info">
                    <strong>{coupon.name}</strong>
                    <p>{coupon.description}</p>
                  </div>
                </td>
                <td>
                  <div className="discount-info">
                    <strong>
                      {coupon.discountType === 'percentage' 
                        ? `${coupon.discountValue}%` 
                        : `$${coupon.discountValue}`
                      }
                    </strong>
                    {coupon.minimumAmount && (
                      <p>Min: ${coupon.minimumAmount}</p>
                    )}
                  </div>
                </td>
                <td>
                  <div className="usage-info">
                    <span>{coupon.usedCount}/{coupon.usageLimit}</span>
                    <div className="usage-bar">
                      <div 
                        className="usage-fill" 
                        style={{width: `${(coupon.usedCount / coupon.usageLimit) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="date-info">
                    <p>From: {new Date(coupon.startDate).toLocaleDateString()}</p>
                    <p>To: {new Date(coupon.endDate).toLocaleDateString()}</p>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(coupon.isActive, coupon.endDate)}`}>
                    {getStatusText(coupon.isActive, coupon.endDate)}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="btn btn-info btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(coupon)}
                      className={`btn btn-sm ${coupon.isActive ? 'btn-warning' : 'btn-success'}`}
                    >
                      {coupon.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* Add/Edit Coupon Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}</h2>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingCoupon(null);
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
                  <label>Coupon Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    required
                    placeholder="e.g., SAVE20"
                  />
                </div>
                <div className="form-group">
                  <label>Coupon Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="e.g., 20% Off All Products"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Coupon description..."
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>Discount Type *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({...formData, discountType: e.target.value})}
                    required
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({...formData, discountValue: e.target.value})}
                    required
                    min="0"
                    step={formData.discountType === 'percentage' ? '1' : '0.01'}
                    placeholder={formData.discountType === 'percentage' ? '20' : '10'}
                  />
                </div>
                <div className="form-group">
                  <label>Minimum Order Amount</label>
                  <input
                    type="number"
                    value={formData.minimumAmount}
                    onChange={(e) => setFormData({...formData, minimumAmount: e.target.value})}
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Maximum Discount</label>
                  <input
                    type="number"
                    value={formData.maximumDiscount}
                    onChange={(e) => setFormData({...formData, maximumDiscount: e.target.value})}
                    min="0"
                    step="0.01"
                    placeholder="No limit"
                  />
                </div>
                <div className="form-group">
                  <label>Usage Limit *</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                    required
                    min="1"
                    placeholder="100"
                  />
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
                  <label>Applies To</label>
                  <select
                    value={formData.appliesTo}
                    onChange={(e) => setFormData({...formData, appliesTo: e.target.value})}
                  >
                    <option value="all">All Products</option>
                    <option value="category">Specific Categories</option>
                    <option value="vendor">Specific Vendors</option>
                    <option value="product">Specific Products</option>
                  </select>
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
                  setEditingCoupon(null);
                  resetForm();
                }} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn btn-primary">
                {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coupons; 