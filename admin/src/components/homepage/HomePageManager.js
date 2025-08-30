import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './HomePageManager.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const HomePageManager = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSections();
    fetchCategories();
  }, []);

  const fetchSections = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/v1/homepage/sections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        const cleaned = (data.data || []).filter(s => String(s.title).toLowerCase() !== 'new arrivals');
        setSections(cleaned);
      }
    } catch (error) {
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/v1/categories?parent=all&page=1&limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const fetchProducts = async (search = '') => {
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      params.append('page', '1');
      params.append('limit', '50');

      const response = await fetch(`${API_BASE}/api/v1/products?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  const handleSectionToggle = async (sectionId, isActive) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/v1/homepage/sections/${sectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Section ${isActive ? 'enabled' : 'disabled'} successfully`);
        fetchSections();
      }
    } catch (error) {
      toast.error('Failed to update section');
    }
  };

  const handleAddProduct = async (sectionId, productId) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/v1/homepage/sections/${sectionId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Product added to section');
        fetchSections();
        setShowProductModal(false);
      }
    } catch (error) {
      toast.error('Failed to add product');
    }
  };

  const handleRemoveProduct = async (sectionId, productId) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/v1/homepage/sections/${sectionId}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Product removed from section');
        fetchSections();
      }
    } catch (error) {
      toast.error('Failed to remove product');
    }
  };

  const handleUpdateSection = async (sectionId, updates) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/v1/homepage/sections/${sectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Section updated successfully');
        fetchSections();
        setShowSectionModal(false);
      }
    } catch (error) {
      toast.error('Failed to update section');
    }
  };

  const getSectionTypeLabel = (type) => {
    const labels = {
      'manual': 'Manual Selection',
      'auto-popular': 'Auto - Most Popular',
      'auto-recent': 'Auto - Recent Products',
      'auto-category': 'Auto - By Category',
      'auto-rating': 'Auto - By Rating'
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="loading">Loading homepage sections...</div>;
  }

  const initSections = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE}/api/v1/homepage/sections/init`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Sections initialized');
        fetchSections();
      } else {
        toast.error(data.message || 'Failed to initialize');
      }
    } catch (e) {
      toast.error('Failed to initialize sections');
    }
  };

  return (
    <div className="homepage-manager">
      <div className="page-header">
        <h2>Homepage Management</h2>
        <p>Manage sections and products displayed on the mobile app homepage</p>
      </div>

      {sections.length === 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <p>No homepage sections found.</p>
          <button className="btn btn-primary" onClick={initSections}>Create default sections</button>
        </div>
      )}

      <div className="sections-grid">
        {sections.filter(s => String(s.title).toLowerCase() !== 'new arrivals').map(section => (
          <div key={section._id} className="section-card">
            <div className="section-header">
              <div className="section-info">
                <h3>{section.title}</h3>
                <span className="section-type">{getSectionTypeLabel(section.type)}</span>
              </div>
              <div className="section-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={section.isActive}
                    onChange={(e) => handleSectionToggle(section._id, e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setSelectedSection(section);
                    setShowSectionModal(true);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="section-stats">
              <div className="stat">
                <span className="stat-label">Products:</span>
                <span className="stat-value">{section.products.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Layout:</span>
                <span className="stat-value">{section.settings.layout}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Max Products:</span>
                <span className="stat-value">{section.settings.maxProducts}</span>
              </div>
            </div>

            <div className="section-products">
              <div className="products-header">
                <h4>Products</h4>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setSelectedSection(section);
                    setShowProductModal(true);
                    fetchProducts();
                  }}
                >
                  Add Product
                </button>
              </div>
              
              <div className="products-list">
                {section.products.map(product => (
                  <div key={product.productId._id} className="product-item">
                    <img 
                      src={product.productId.images[0]} 
                      alt={product.productId.name}
                      className="product-image"
                    />
                    <div className="product-info">
                      <span className="product-name">{product.productId.name}</span>
                      <span className="product-price">${product.productId.specialPrice ?? product.productId.regularPrice ?? product.productId.price}</span>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveProduct(section._id, product.productId._id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section Edit Modal */}
      {showSectionModal && selectedSection && (
        <SectionEditModal
          section={selectedSection}
          categories={categories}
          onClose={() => setShowSectionModal(false)}
          onSave={handleUpdateSection}
        />
      )}

      {/* Product Selection Modal */}
      {showProductModal && selectedSection && (
        <ProductSelectionModal
          section={selectedSection}
          products={products}
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          onSearchSubmit={() => fetchProducts(searchTerm)}
          onAddProduct={handleAddProduct}
          onClose={() => setShowProductModal(false)}
        />
      )}
    </div>
  );
};

// Section Edit Modal Component
const SectionEditModal = ({ section, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: section.title,
    settings: { maxProducts: section.settings?.maxProducts ?? 10 },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(section._id, { title: formData.title, settings: { maxProducts: formData.settings.maxProducts } });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Section: {section.title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Section Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Max Products</label>
            <input
              type="number"
              min="1"
              max="50"
              value={formData.settings.maxProducts}
              onChange={(e) => setFormData({
                ...formData, 
                settings: { maxProducts: parseInt(e.target.value) }
              })}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Product Selection Modal Component
const ProductSelectionModal = ({ section, products, searchTerm, onSearch, onSearchSubmit, onAddProduct, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Products to {section.title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              className="search-input"
            />
            <button className="btn btn-primary" onClick={onSearchSubmit}>
              Search
            </button>
          </div>

          <div className="products-grid">
            {products.map(product => (
              <div key={product._id} className="product-card">
                <img 
                  src={product.images[0]} 
                  alt={product.name}
                  className="product-image"
                />
                <div className="product-info">
                  <h4>{product.name}</h4>
                  <p>${product.price}</p>
                  <p>Rating: {product.rating || 0}/5</p>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onAddProduct(section._id, product._id)}
                >
                  Add to Section
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePageManager;