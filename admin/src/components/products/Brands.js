import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Brands.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Brands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoPreview: '',
    categories: [],
    featured: false
  });
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [currentPage, itemsPerPage, searchTerm]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const qParam = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';
      const res = await fetch(`${API_BASE}/api/v1/brands?page=${currentPage}&limit=${itemsPerPage}${qParam}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch brands');
      setBrands(json.data || []);
      const totalValue = json?.meta?.total ?? (json.data?.length || 0);
      setTotal(totalValue);
      const pagesCount = Math.max(1, Math.ceil(totalValue / itemsPerPage));
      if (currentPage > pagesCount) {
        setCurrentPage(pagesCount);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error(error.message || 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/categories?parent=all&page=1&limit=1000`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch categories');
      const items = json.data || [];
      const mapped = items.map(c => ({ id: c._id, name: c.name }));
      setCategories(mapped);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error(error.message || 'Failed to load categories');
    }
  };

  const getUploadSignature = async (subfolder) => {
    const res = await fetch(`${API_BASE}/api/v1/uploads/signature`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: subfolder })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to get upload signature');
    return json.data; // includes cloudName and apiKey
  };

  const uploadToCloudinary = async (file, subfolder = 'brands') => {
    const { signature, timestamp, folder, apiKey, cloudName } = await getUploadSignature(subfolder);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', apiKey);
    fd.append('timestamp', String(timestamp));
    fd.append('signature', signature);
    fd.append('folder', folder);
    fd.append('unique_filename', 'true');
    fd.append('overwrite', 'false');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: fd
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Cloudinary upload failed');
    return { imageUrl: json.secure_url, imagePublicId: json.public_id };
  };

  const handleAddBrand = () => {
    setFormData({
      name: '',
      description: '',
      logoPreview: '',
      categories: [],
      featured: false
    });
    setImageFile(null);
    setShowAddModal(true);
  };

  const handleEditBrand = (brand) => {
    setSelectedBrand(brand);
    setFormData({
      name: brand.name || '',
      description: brand.description || '',
      logoPreview: brand.logo || '',
      categories: Array.isArray(brand.categories) ? brand.categories.map(c => (typeof c === 'string' ? c : (c?._id || c))) : [],
      featured: !!brand.featured
    });
    setImageFile(null);
    setShowEditModal(true);
  };

  const handleDeleteBrand = async (brand) => {
    if (!window.confirm('Are you sure you want to delete this brand?')) return;
    try {
      const id = brand._id || brand.id;
      const res = await fetch(`${API_BASE}/api/v1/brands/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete brand');
      toast.success('Brand deleted successfully');
      fetchBrands();
    } catch (error) {
      toast.error(error.message || 'Failed to delete brand');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (submitting) return;
      setSubmitting(true);

      if (!formData.name.trim()) {
        toast.error('Name is required');
        setSubmitting(false);
        return;
      }
      if (!imageFile && !formData.logoPreview && showAddModal) {
        toast.error('Logo is required');
        setSubmitting(false);
        return;
      }
      if (!Array.isArray(formData.categories) || formData.categories.length === 0) {
        toast.error('Please select at least one category');
        setSubmitting(false);
        return;
      }

      let payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        categories: formData.categories,
        featured: !!formData.featured
      };

      if (imageFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(imageFile, 'brands');
        payload.imageUrl = imageUrl;
        payload.imagePublicId = imagePublicId;
      }

      if (showAddModal) {
        const res = await fetch(`${API_BASE}/api/v1/brands`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to add brand');
        toast.success('Brand added successfully');
      } else {
        const id = selectedBrand?._id || selectedBrand?.id;
        const res = await fetch(`${API_BASE}/api/v1/brands/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to update brand');
        toast.success('Brand updated successfully');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setImageFile(null);
      fetchBrands();
    } catch (error) {
      toast.error(error.message || 'Failed to save brand');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const logoUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        logoPreview: logoUrl
      }));
    }
  };

  const handleCategoryChange = (categoryId) => {
    setFormData(prev => {
      const exists = prev.categories.includes(categoryId);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter(id => id !== categoryId)
          : [...prev.categories, categoryId]
      };
    });
  };

  const getCategoryNames = (categoryIds) => {
    if (!categoryIds || categoryIds.length === 0) return 'None';
    return categoryIds
      .map(id => {
        const category = categories.find(cat => cat.id === id);
        return category ? category.name : 'Unknown';
      })
      .join(', ');
  };

  const pagesCount = Math.max(1, Math.ceil(total / itemsPerPage));

  if (loading) {
    return <div className="loading">Loading brands...</div>;
  }

  return (
    <div className="brands-container">
      <div className="page-header">
        <h1>Brand Management</h1>
        <div className="header-actions">
          <button onClick={handleAddBrand} className="btn btn-primary">
            Add Brand
          </button>
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Brands</h3>
          <p>{total}</p>
        </div>
        <div className="stat-card">
          <h3>Featured Brands</h3>
          <p>{brands.filter(brand => brand.featured).length}</p>
        </div>
        <div className="stat-card">
          <h3>Active Brands</h3>
          <p>{brands.length}</p>
        </div>
      </div>

      <div className="brands-table-container">
        <table className="brands-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Categories</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand._id || brand.id}>
                <td>
                  <div className="brand-info">
                    <img src={brand.logo || '/default-brand.png'} alt={brand.name} className="brand-logo" />
                    <div>
                      <strong>{brand.name}</strong>
                      <small>{brand.description}</small>
                    </div>
                  </div>
                </td>
                <td>{getCategoryNames(brand.categories || [])}</td>
                <td>
                  <span className={`featured-badge ${brand.featured ? 'featured' : 'not-featured'}`}>
                    {brand.featured ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEditBrand(brand)}
                      className="btn btn-info btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBrand(brand)}
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

      {pagesCount > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {pagesCount}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(pagesCount, p + 1))}
            disabled={currentPage === pagesCount}
            className="btn btn-secondary"
          >
            Next
          </button>
          <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="page-size-select" style={{ marginLeft: 8 }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      )}

      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{showAddModal ? 'Add New Brand' : 'Edit Brand'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Brand Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="4"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Brand Logo *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                  {formData.logoPreview && (
                    <div className="logo-preview">
                      <img src={formData.logoPreview} alt="Brand logo preview" />
                    </div>
                  )}
                </div>

                <div className="form-group full-width">
                  <label>Assigned Categories *</label>
                  <div className="categories-selection">
                    {categories.map(category => (
                      <div key={category.id} className="category-checkbox">
                        <input
                          type="checkbox"
                          id={`category-${category.id}`}
                          checked={formData.categories.includes(category.id)}
                          onChange={() => handleCategoryChange(category.id)}
                        />
                        <label htmlFor={`category-${category.id}`}>
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button 
                onClick={() => { setShowAddModal(false); setShowEditModal(false); }} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : (showAddModal ? 'Add Brand' : 'Update Brand')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Brands; 