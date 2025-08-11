import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Brands.css';

const Brands = () => {
  const [brands, setBrands] = useState([]);
  const [filteredBrands, setFilteredBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo: '',
    website: '',
    categories: [],
    featured: false,
    sortOrder: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterBrands();
  }, [brands, searchTerm]);

  const fetchData = async () => {
    try {
      const response = await fetch('/data.json');
      const data = await response.json();
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const filterBrands = () => {
    let filtered = brands;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(brand =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        brand.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        brand.website.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBrands(filtered);
    setCurrentPage(1);
  };

  const handleAddBrand = () => {
    setFormData({
      name: '',
      description: '',
      logo: '',
      website: '',
      categories: [],
      featured: false,
      sortOrder: 0
    });
    setShowAddModal(true);
  };

  const handleEditBrand = (brand) => {
    setSelectedBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      logo: brand.logo || '',
      website: brand.website || '',
      categories: brand.categories || [],
      featured: brand.featured || false,
      sortOrder: brand.sortOrder || 0
    });
    setShowEditModal(true);
  };

  const handleDeleteBrand = async (brandId) => {
    if (window.confirm('Are you sure you want to delete this brand? This action cannot be undone.')) {
      try {
        // Check if brand has products
        const hasProducts = false; // This would be checked against products data
        if (hasProducts) {
          toast.error('Cannot delete brand with products. Please remove products first.');
          return;
        }

        const updatedBrands = brands.filter(brand => brand.id !== brandId);
        setBrands(updatedBrands);
        toast.success('Brand deleted successfully');
      } catch (error) {
        toast.error('Failed to delete brand');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (showAddModal) {
      // Add new brand
      const newBrand = {
        id: Date.now(),
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setBrands([...brands, newBrand]);
      toast.success('Brand added successfully');
    } else {
      // Update existing brand
      const updatedBrands = brands.map(brand =>
        brand.id === selectedBrand.id 
          ? { 
              ...brand, 
              ...formData,
              updatedAt: new Date().toISOString()
            }
          : brand
      );
      setBrands(updatedBrands);
      toast.success('Brand updated successfully');
    }
    
    setShowAddModal(false);
    setShowEditModal(false);
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
      const logoUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        logo: logoUrl
      }));
    }
  };

  const handleCategoryChange = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const toggleFeatured = async (brandId) => {
    try {
      const updatedBrands = brands.map(brand =>
        brand.id === brandId 
          ? { ...brand, featured: !brand.featured, updatedAt: new Date().toISOString() }
          : brand
      );
      setBrands(updatedBrands);
      toast.success('Featured status updated successfully');
    } catch (error) {
      toast.error('Failed to update featured status');
    }
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

  const getProductCount = (brandId) => {
    // This would be calculated from products data
    // For now, returning a random number for demonstration
    return Math.floor(Math.random() * 100);
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBrands = filteredBrands.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBrands.length / itemsPerPage);

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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Brands</h3>
          <p>{brands.length}</p>
        </div>
        <div className="stat-card">
          <h3>Featured Brands</h3>
          <p>{brands.filter(brand => brand.featured).length}</p>
        </div>
        <div className="stat-card">
          <h3>Active Brands</h3>
          <p>{brands.length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Products</h3>
          <p>{brands.reduce((sum, brand) => sum + getProductCount(brand.id), 0)}</p>
        </div>
      </div>

      <div className="brands-table-container">
        <table className="brands-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Website</th>
              <th>Categories</th>
              <th>Products</th>
              <th>Featured</th>
              <th>Sort Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentBrands.map((brand) => (
              <tr key={brand.id}>
                <td>
                  <div className="brand-info">
                    <img src={brand.logo || '/default-brand.png'} alt={brand.name} className="brand-logo" />
                    <div>
                      <strong>{brand.name}</strong>
                      <small>{brand.description}</small>
                    </div>
                  </div>
                </td>
                <td>
                  {brand.website ? (
                    <a href={brand.website} target="_blank" rel="noopener noreferrer" className="website-link">
                      {brand.website}
                    </a>
                  ) : (
                    <span className="no-website">No website</span>
                  )}
                </td>
                <td>{getCategoryNames(brand.categories)}</td>
                <td>{getProductCount(brand.id)}</td>
                <td>
                  <span className={`featured-badge ${brand.featured ? 'featured' : 'not-featured'}`}>
                    {brand.featured ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>{brand.sortOrder || 0}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEditBrand(brand)}
                      className="btn btn-info btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleFeatured(brand.id)}
                      className={`btn btn-sm ${brand.featured ? 'btn-warning' : 'btn-success'}`}
                    >
                      {brand.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      onClick={() => handleDeleteBrand(brand.id)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Brands Grid View */}
      <div className="brands-grid-section">
        <h2>Brands Overview</h2>
        <div className="brands-grid">
          {brands.map((brand) => (
            <div key={brand.id} className="brand-card">
              <div className="brand-card-header">
                <img src={brand.logo || '/default-brand.png'} alt={brand.name} className="brand-card-logo" />
                {brand.featured && <span className="featured-star">★</span>}
              </div>
              <div className="brand-card-body">
                <h3>{brand.name}</h3>
                <p>{brand.description}</p>
                <div className="brand-stats">
                  <span>{getProductCount(brand.id)} Products</span>
                  <span>{getCategoryNames(brand.categories)}</span>
                </div>
                {brand.website && (
                  <a href={brand.website} target="_blank" rel="noopener noreferrer" className="brand-website">
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Brand Modal */}
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
                
                <div className="form-group">
                  <label>Website</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    name="sortOrder"
                    value={formData.sortOrder}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Featured Brand</label>
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      name="featured"
                      checked={formData.featured}
                      onChange={handleInputChange}
                    />
                    <span>Mark as featured</span>
                  </div>
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
                  <label>Brand Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                  {formData.logo && (
                    <div className="logo-preview">
                      <img src={formData.logo} alt="Brand logo preview" />
                    </div>
                  )}
                </div>

                <div className="form-group full-width">
                  <label>Assigned Categories</label>
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
              <button onClick={handleSubmit} className="btn btn-primary">
                {showAddModal ? 'Add Brand' : 'Update Brand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Brands; 