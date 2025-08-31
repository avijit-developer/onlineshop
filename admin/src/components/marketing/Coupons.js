import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Coupons.css';

const API_BASE = process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [template, setTemplate] = useState('custom');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Selection sources
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productPicker, setProductPicker] = useState({ query: '', results: [], selected: [] });

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
    perUserLimit: '',
    usedCount: 0,
    startDate: '',
    endDate: '',
    isActive: true,
    appliesTo: 'all',
    vendorIds: [],
    categoryIds: [],
    productIds: [],
    freeShipping: false,
    allowedPaymentMethods: [],
    ruleType: 'standard',
    bogoBuyProductIds: [],
    bogoGetProductIds: [],
    bogoBuyQty: 1,
    bogoGetQty: 1,
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  // Refetch when page, search, or status changes
  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, filterStatus]);

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

  const applyTemplate = (tpl) => {
    setTemplate(tpl);
    if (tpl === 'custom') return;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const fmt = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const base = {
      description: '',
      minimumAmount: '',
      maximumDiscount: '',
      usageLimit: '1000',
      perUserLimit: '',
      startDate: fmt(now),
      endDate: fmt(in30),
      isActive: true,
      vendorIds: [],
      categoryIds: [],
      productIds: [],
      freeShipping: false,
      allowedPaymentMethods: [],
      ruleType: 'standard',
      bogoBuyProductIds: [],
      bogoGetProductIds: [],
      bogoBuyQty: 1,
      bogoGetQty: 1,
    };
    const presets = {
      global_percent: {
        code: 'WELCOME10', name: '10% off sitewide', discountType: 'percentage', discountValue: '10', appliesTo: 'all'
      },
      vendor_percent: {
        code: 'NIKE20', name: '20% off selected vendor', discountType: 'percentage', discountValue: '20', appliesTo: 'vendor'
      },
      category_percent: {
        code: 'FASHION15', name: '15% off category', discountType: 'percentage', discountValue: '15', appliesTo: 'category'
      },
      product_fixed: {
        code: 'PROD10', name: '₹10 off selected products', discountType: 'fixed', discountValue: '10', appliesTo: 'product'
      },
      cart_fixed_min: {
        code: 'SAVE200', name: '₹200 off above ₹2000', discountType: 'fixed', discountValue: '200', appliesTo: 'all', minimumAmount: '2000'
      },
      bogo_50: {
        code: 'BOGO50', name: 'Buy 1 get 1 at 50% off', discountType: 'percentage', discountValue: '50', appliesTo: 'product', ruleType: 'bogo', bogoBuyQty: 1, bogoGetQty: 1
      },
      free_shipping_min: {
        code: 'FREESHIP', name: 'Free shipping above ₹500', discountType: 'fixed', discountValue: '0', appliesTo: 'all', freeShipping: true, minimumAmount: '500'
      },
      new_user_flat: {
        code: 'NEW100', name: '₹100 off for new users', discountType: 'fixed', discountValue: '100', appliesTo: 'new_user'
      },
      payment_percent: {
        code: 'PAYTM20', name: '20% off with PayTM', discountType: 'percentage', discountValue: '20', appliesTo: 'all', allowedPaymentMethods: ['paytm']
      }
    };
    const p = presets[tpl];
    if (!p) return;
    setFormData(prev => ({
      ...prev,
      ...base,
      ...p
    }));
  };

  // Load vendors and categories for Applies To selectors
  useEffect(() => {
    (async () => {
      try {
        const [venRes, catRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/vendors?page=1&limit=1000`, { headers: getAuthHeaders() }).catch(() => ({ ok: true, json: async () => ({ data: [] }) })),
          fetch(`${API_BASE}/api/v1/categories?parent=all&page=1&limit=1000`, { headers: getAuthHeaders() })
        ]);
        const [venJson, catJson] = await Promise.all([venRes.json(), catRes.json()]);
        if (venRes.ok) setVendors((venJson.data || []).map(v => ({ id: v._id || v.id, name: v.companyName })));
        if (catRes.ok) setCategories((catJson.data || []).map(c => ({ id: c._id || c.id, name: c.name })));
      } catch (_) {}
    })();
  }, []);

  const toggleVendor = (id) => {
    setFormData(prev => {
      const exists = prev.vendorIds.includes(id);
      return { ...prev, vendorIds: exists ? prev.vendorIds.filter(v => v !== id) : [...prev.vendorIds, id] };
    });
  };

  const toggleCategory = (id) => {
    setFormData(prev => {
      const exists = prev.categoryIds.includes(id);
      return { ...prev, categoryIds: exists ? prev.categoryIds.filter(v => v !== id) : [...prev.categoryIds, id] };
    });
  };

  const searchProducts = async () => {
    try {
      const q = productPicker.query.trim();
      if (!q) { setProductPicker(prev => ({ ...prev, results: [] })); return; }
      const params = new URLSearchParams({ q, page: '1', limit: '10' });
      const res = await fetch(`${API_BASE}/api/v1/products?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json?.success) {
        const items = (json.data || []).map(p => ({ id: p._id || p.id, name: p.name, image: (p.images && p.images[0]) }));
        setProductPicker(prev => ({ ...prev, results: items }));
      }
    } catch (_) {}
  };

  const addProductToCoupon = (item) => {
    setProductPicker(prev => {
      if (prev.selected.find(s => String(s.id) === String(item.id))) return prev;
      return { ...prev, selected: [...prev.selected, item] };
    });
    setFormData(prev => {
      const existing = new Set((prev.productIds || []).map(String));
      existing.add(String(item.id));
      return { ...prev, productIds: Array.from(existing) };
    });
  };

  const removeProductFromCoupon = (id) => {
    setProductPicker(prev => ({ ...prev, selected: prev.selected.filter(s => String(s.id) !== String(id)) }));
    setFormData(prev => ({ ...prev, productIds: (prev.productIds || []).filter(pid => String(pid) !== String(id)) }));
  };

  // Load selected products details for edit modal
  const loadSelectedProducts = async (ids) => {
    try {
      const tokenHeaders = getAuthHeaders();
      const requests = ids.map(async (pid) => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/products/${pid}`, { headers: tokenHeaders });
          const json = await res.json();
          if (res.ok && json?.success && json?.data) {
            const p = json.data;
            return { id: p._id || p.id, name: p.name, image: (p.images && p.images[0]) };
          }
        } catch (_) {}
        return null;
      });
      const results = (await Promise.all(requests)).filter(Boolean);
      setProductPicker(prev => ({ ...prev, selected: results }));
    } catch (_) {}
  };

  // When opening edit modal, populate selected product chips from productIds
  useEffect(() => {
    if (showModal && formData.appliesTo === 'product' && Array.isArray(formData.productIds) && formData.productIds.length > 0) {
      loadSelectedProducts(formData.productIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, formData.appliesTo]);

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
        perUserLimit: formData.perUserLimit !== '' ? Number(formData.perUserLimit) : undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: !!formData.isActive,
        appliesTo: formData.appliesTo,
        vendorIds: formData.vendorIds || [],
        categoryIds: formData.categoryIds || [],
        productIds: formData.productIds || [],
        freeShipping: !!formData.freeShipping,
        allowedPaymentMethods: formData.allowedPaymentMethods || [],
        ruleType: formData.ruleType,
        bogoBuyProductIds: formData.bogoBuyProductIds || [],
        bogoGetProductIds: formData.bogoGetProductIds || [],
        bogoBuyQty: Number(formData.bogoBuyQty) || 1,
        bogoGetQty: Number(formData.bogoGetQty) || 1,
      };

      if (editingCoupon) {
        const id = editingCoupon._id || editingCoupon.id;
        const res = await fetch(`${API_BASE}/api/v1/coupons/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...payload,
            // send arrays only relevant to appliesTo to avoid backend replacing unintended fields
            vendorIds: payload.appliesTo === 'vendor' ? payload.vendorIds : undefined,
            categoryIds: payload.appliesTo === 'category' ? payload.categoryIds : undefined,
            productIds: payload.appliesTo === 'product' ? payload.productIds : undefined,
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to update coupon');
        toast.success('Coupon updated successfully');
      } else {
        const res = await fetch(`${API_BASE}/api/v1/coupons`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...payload,
            vendorIds: payload.appliesTo === 'vendor' ? payload.vendorIds : [],
            categoryIds: payload.appliesTo === 'category' ? payload.categoryIds : [],
            productIds: payload.appliesTo === 'product' ? payload.productIds : [],
          })
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

  const formatDateInput = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setProductPicker({ query: '', results: [], selected: [] });
    setFormData({
      code: coupon.code || '',
      name: coupon.name || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue ?? '',
      minimumAmount: coupon.minimumAmount ?? '',
      maximumDiscount: coupon.maximumDiscount ?? '',
      usageLimit: coupon.usageLimit ?? '',
      perUserLimit: coupon.perUserLimit ?? '',
      usedCount: coupon.usedCount ?? 0,
      startDate: formatDateInput(coupon.startDate),
      endDate: formatDateInput(coupon.endDate),
      isActive: !!coupon.isActive,
      appliesTo: coupon.appliesTo || 'all',
      vendorIds: (coupon.vendorIds || []).map(v => typeof v === 'object' ? (v._id || v.id) : v),
      categoryIds: (coupon.categoryIds || []).map(v => typeof v === 'object' ? (v._id || v.id) : v),
      productIds: (coupon.productIds || []).map(v => typeof v === 'object' ? (v._id || v.id) : v),
      freeShipping: !!coupon.freeShipping,
      allowedPaymentMethods: Array.isArray(coupon.allowedPaymentMethods) ? coupon.allowedPaymentMethods : [],
      ruleType: coupon.ruleType || 'standard',
      bogoBuyProductIds: (coupon.bogoBuyProductIds || []).map(v => typeof v === 'object' ? (v._id || v.id) : v),
      bogoGetProductIds: (coupon.bogoGetProductIds || []).map(v => typeof v === 'object' ? (v._id || v.id) : v),
      bogoBuyQty: coupon.bogoBuyQty ?? 1,
      bogoGetQty: coupon.bogoGetQty ?? 1,
    });
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

  const handleToggleStatus = async (couponId, newActive) => {
    try {
      const id = couponId;
      const res = await fetch(`${API_BASE}/api/v1/coupons/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !!newActive })
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

  const computeCouponType = (c) => {
    if (c.ruleType === 'bogo') return 'BOGO';
    if (c.freeShipping) return 'Free Shipping';
    if (c.appliesTo === 'new_user') return 'New User';
    if (Array.isArray(c.allowedPaymentMethods) && c.allowedPaymentMethods.length > 0) return 'Payment Method';
    if (c.appliesTo === 'vendor') return 'Vendor';
    if (c.appliesTo === 'category') return 'Category';
    if (c.appliesTo === 'product') return 'Product';
    return 'Global';
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
              <th>Type</th>
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
                <td>{computeCouponType(coupon)}</td>
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
                  <div className="action-buttons" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="btn btn-info btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(coupon._id || coupon.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                    <label className="toggle-switch" title="Active">
                      <input type="checkbox" checked={!!coupon.isActive} onChange={(e) => handleToggleStatus(coupon._id || coupon.id, e.target.checked)} />
                      <span className="slider" />
                    </label>
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
                  <label>Template</label>
                  <select value={template} onChange={(e) => applyTemplate(e.target.value)}>
                    <option value="custom">Custom</option>
                    <option value="global_percent">Global Percent (WELCOME10)</option>
                    <option value="vendor_percent">Vendor Percent (NIKE20)</option>
                    <option value="category_percent">Category Percent (FASHION15)</option>
                    <option value="product_fixed">Product Fixed (PROD10)</option>
                    <option value="cart_fixed_min">Cart Fixed with Min (SAVE200)</option>
                    <option value="bogo_50">BOGO 1+1 @50% (BOGO50)</option>
                    <option value="free_shipping_min">Free Shipping with Min (FREESHIP)</option>
                    <option value="new_user_flat">New User Flat (NEW100)</option>
                    <option value="payment_percent">Payment Method Percent (PAYTM20)</option>
                  </select>
                </div>
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
                <div className="form-group full-width">
                  <label>Summary</label>
                  <div style={{ fontSize: 12, color: '#555' }}>
                    This coupon applies to <strong>{computeCouponType(formData)}</strong>{formData.minimumAmount ? ` with min order ₹${formData.minimumAmount}` : ''}{formData.freeShipping ? ` and grants Free Shipping` : ''}{Array.isArray(formData.allowedPaymentMethods) && formData.allowedPaymentMethods.length>0 ? ` when paying via ${formData.allowedPaymentMethods.join(', ')}` : ''}.
                  </div>
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
                  <label>Per User Limit</label>
                  <input
                    type="number"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({...formData, perUserLimit: e.target.value})}
                    min="1"
                    placeholder="1"
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
                  <label>Payment Methods (optional)</label>
                  <input
                    type="text"
                    value={formData.allowedPaymentMethods.join(',')}
                    onChange={(e) => setFormData({ ...formData, allowedPaymentMethods: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g., paytm, upi, card, cod"
                  />
                </div>
                <div className="form-group">
                  <label>Free Shipping</label>
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="freeShipping"
                      checked={!!formData.freeShipping}
                      onChange={(e) => setFormData({...formData, freeShipping: e.target.checked})}
                    />
                    <label htmlFor="freeShipping">Enable free shipping</label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Rule Type</label>
                  <select
                    value={formData.ruleType}
                    onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                  >
                    <option value="standard">Standard</option>
                    <option value="bogo">Buy X Get Y (BOGO)</option>
                  </select>
                </div>
                {formData.ruleType === 'bogo' && (
                  <div className="form-group full-width">
                    <label>BOGO Config</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <div>
                        <label>Buy Qty</label>
                        <input type="number" min="1" value={formData.bogoBuyQty} onChange={(e) => setFormData({ ...formData, bogoBuyQty: e.target.value })} />
                      </div>
                      <div>
                        <label>Get Qty</label>
                        <input type="number" min="1" value={formData.bogoGetQty} onChange={(e) => setFormData({ ...formData, bogoGetQty: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
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
                    <option value="new_user">New User</option>
                  </select>
                </div>
                {formData.appliesTo === 'vendor' && (
                  <div className="form-group full-width">
                    <label>Select Vendors</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {vendors.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          className={`btn btn-sm ${formData.vendorIds.includes(v.id) ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleVendor(v.id)}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {formData.appliesTo === 'category' && (
                  <div className="form-group full-width">
                    <label>Select Categories</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {categories.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`btn btn-sm ${formData.categoryIds.includes(c.id) ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleCategory(c.id)}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {formData.appliesTo === 'product' && (
                  <div className="form-group full-width">
                    <label>Select Products</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productPicker.query}
                        onChange={(e) => setProductPicker(prev => ({ ...prev, query: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={searchProducts}>Search</button>
                    </div>
                    {productPicker.results.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
                        {productPicker.results.map(item => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
                            <img src={item.image || '/default-product.png'} alt={item.name} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                            <div style={{ flex: 1, fontSize: 12 }}>{item.name}</div>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => addProductToCoupon(item)}>Add</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {productPicker.selected.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {productPicker.selected.map(item => (
                          <div key={item.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #eee', padding: '4px 8px', borderRadius: 20 }}>
                            <img src={item.image || '/default-product.png'} alt={item.name} style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover' }} />
                            <span style={{ fontSize: 12 }}>{item.name}</span>
                            <button
                              type="button"
                              onClick={() => removeProductFromCoupon(item.id)}
                              title="Remove"
                              style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '1px solid #ddd',
                                background: '#fff',
                                color: '#999',
                                lineHeight: '18px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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