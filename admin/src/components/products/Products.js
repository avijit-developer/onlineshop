import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Products.css';

const Products = () => {
  // Dynamic matrix variant state
  const [variantAttributes, setVariantAttributes] = useState([]); // e.g. ['Attribute1', 'Attribute2']
  const [attributeValues, setAttributeValues] = useState({}); // { Attribute1: ['A', 'B'], Attribute2: ['X', 'Y'] }
  const [matrixVariants, setMatrixVariants] = useState([]);

  // Generate matrix combinations (dynamic)
  const generateMatrixVariants = () => {
    if (variantAttributes.length === 0) return;
    // Get arrays of values for each attribute
    const valuesArr = variantAttributes.map(attr => attributeValues[attr] || []);
    // Cartesian product
    const cartesian = (arr) => arr.reduce((a, b) => a.flatMap(d => b.map(e => [...d, e])), [[]]);
    const combos = cartesian(valuesArr);
    setMatrixVariants(combos.map(combo => {
      const obj = {};
      combo.forEach((val, idx) => { obj[variantAttributes[idx]] = val; });
      return { ...obj, price: '', specialPrice: '', images: [] };
    }));
  };

  // Update attribute names
  const handleAttributeNamesChange = (names) => {
    setVariantAttributes(names);
    // Reset values for removed attributes
    setAttributeValues(prev => {
      const updated = {};
      names.forEach(n => { updated[n] = prev[n] || []; });
      return updated;
    });
  };

  // Update values for a specific attribute
  const handleAttributeValuesChange = (attr, values) => {
    setAttributeValues(prev => ({ ...prev, [attr]: values }));
  };

  // Update matrix variant field
  const updateMatrixVariant = (index, field, value) => {
    setMatrixVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [brands, setBrands] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    brandId: '',
    vendorId: '',
    regularPrice: '',
    specialPrice: '',
    tax: '',
    stock: '',
    lowStockAlert: '',
    sku: '',
    tags: '',
    seoTitle: '',
    seoDescription: '',
    images: [],
    variants: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, statusFilter, categoryFilter, vendorFilter]);

  const fetchData = async () => {
    try {
      const response = await fetch('/data.json');
      const data = await response.json();
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setVendors(data.vendors || []);
      setBrands(data.brands || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => product.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.categoryId === parseInt(categoryFilter));
    }

    // Vendor filter
    if (vendorFilter !== 'all') {
      filtered = filtered.filter(product => product.vendorId === parseInt(vendorFilter));
    }

    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const handleStatusChange = async (productId, newStatus) => {
    try {
      const updatedProducts = products.map(product =>
        product.id === productId ? { ...product, status: newStatus } : product
      );
      setProducts(updatedProducts);
      
      toast.success(`Product ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toast.error('Failed to update product status');
    }
  };

  const handleAddProduct = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      brandId: '',
      vendorId: '',
      regularPrice: '',
      specialPrice: '',
      tax: '',
      stock: '',
      lowStockAlert: '',
      sku: '',
      tags: '',
      seoTitle: '',
      seoDescription: '',
      images: [],
      variants: []
    });
    setShowAddModal(true);
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      brandId: product.brandId,
      vendorId: product.vendorId,
      regularPrice: product.regularPrice,
      specialPrice: product.specialPrice || '',
      tax: product.tax,
      stock: product.stock,
      lowStockAlert: product.lowStockAlert || '',
      sku: product.sku,
      tags: product.tags?.join(', ') || '',
      seoTitle: product.seoTitle || '',
      seoDescription: product.seoDescription || '',
      images: product.images || [],
      variants: product.variants || []
    });
    setShowEditModal(true);
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (showAddModal) {
      // Add new product
      const newProduct = {
        id: Date.now(),
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setProducts([...products, newProduct]);
      toast.success('Product added successfully');
    } else {
      // Update existing product
      const updatedProducts = products.map(product =>
        product.id === selectedProduct.id 
          ? { 
              ...product, 
              ...formData,
              tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
              updatedAt: new Date().toISOString()
            }
          : product
      );
      setProducts(updatedProducts);
      toast.success('Product updated successfully');
    }
    
    setShowAddModal(false);
    setShowEditModal(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const imageUrls = files.map(file => URL.createObjectURL(file));
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...imageUrls]
    }));
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: Date.now(),
        name: '',
        options: [],
        price: '',
        specialPrice: '',
        stock: '',
        sku: '',
        images: [] // array of File objects or URLs
      }]
    }));
  };

  const updateVariant = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) => 
        i === index ? { ...variant, [field]: value } : variant
      )
    }));
  };

  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.companyName : 'N/A';
  };

  const getBrandName = (brandId) => {
    const brand = brands.find(b => b.id === brandId);
    return brand ? brand.name : 'N/A';
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="products-container">
      <div className="page-header">
        <h1>Product Management</h1>
        <div className="header-actions">
          <button onClick={handleAddProduct} className="btn btn-primary">
            Add Product
          </button>
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Vendors</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.companyName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Products</h3>
          <p>{products.length}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Approval</h3>
          <p>{products.filter(p => p.status === 'pending').length}</p>
        </div>
        <div className="stat-card">
          <h3>Low Stock</h3>
          <p>{products.filter(p => p.stock <= (p.lowStockAlert || 10)).length}</p>
        </div>
        <div className="stat-card">
          <h3>Out of Stock</h3>
          <p>{products.filter(p => p.stock === 0).length}</p>
        </div>
      </div>

      <div className="products-table-container">
        <table className="products-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="product-info">
                    <img src={product.images[0] || '/default-product.png'} alt={product.name} className="product-image" />
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.description.substring(0, 50)}...</small>
                    </div>
                  </div>
                </td>
                <td>{product.sku}</td>
                <td>{getCategoryName(product.categoryId)}</td>
                <td>{getVendorName(product.vendorId)}</td>
                <td>
                  <div className="price-info">
                    <span className="regular-price">${product.regularPrice}</span>
                    {product.specialPrice && (
                      <span className="special-price">${product.specialPrice}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`stock-badge ${product.stock === 0 ? 'out-of-stock' : product.stock <= (product.lowStockAlert || 10) ? 'low-stock' : 'in-stock'}`}>
                    {product.stock}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${product.status}`}>
                    {product.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleViewDetails(product)}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="btn btn-info btn-sm"
                    >
                      Edit
                    </button>
                    {product.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(product.id, 'approved')}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(product.id, 'rejected')}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
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

      {/* Add/Edit Product Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal product-modal large-modal">
            <div className="modal-header">
              <h2>{showAddModal ? 'Add New Product' : 'Edit Product'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>SKU *</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Brand</label>
                  <select
                    name="brandId"
                    value={formData.brandId}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Brand</option>
                    {brands.map(brand => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vendor *</label>
                  <select
                    name="vendorId"
                    value={formData.vendorId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>{vendor.companyName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Regular Price *</label>
                  <input
                    type="number"
                    name="regularPrice"
                    value={formData.regularPrice}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Special Price</label>
                  <input
                    type="number"
                    name="specialPrice"
                    value={formData.specialPrice}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label>Tax (%)</label>
                  <input
                    type="number"
                    name="tax"
                    value={formData.tax}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>

                <div className="form-group">
                  <label>Stock Quantity *</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Low Stock Alert</label>
                  <input
                    type="number"
                    name="lowStockAlert"
                    value={formData.lowStockAlert}
                    onChange={handleInputChange}
                    min="0"
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

                <div className="form-group">
                  <label>Tags</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                <div className="form-group">
                  <label>SEO Title</label>
                  <input
                    type="text"
                    name="seoTitle"
                    value={formData.seoTitle}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label>SEO Description</label>
                  <textarea
                    name="seoDescription"
                    value={formData.seoDescription}
                    onChange={handleInputChange}
                    rows="3"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Product Images</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <div className="image-preview">
                    {formData.images.map((image, index) => (
                      <div key={index} className="image-item">
                        <img src={image} alt={`Product ${index + 1}`} />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="remove-image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Variants</label>
                  {/* Matrix Variant UI */}
                  <div className="matrix-variant-section">
                    <div style={{ marginBottom: 12 }}>
                      <label>Variant Attributes (comma separated):</label>
                      <input
                        type="text"
                        value={variantAttributes.join(', ')}
                        onChange={e => {
                          const arr = e.target.value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                          handleAttributeNamesChange(arr);
                        }}
                        placeholder="e.g. Attribute1, Attribute2, Attribute3"
                      />
                    </div>
                    {variantAttributes.map(attr => (
                      <div key={attr} style={{ marginBottom: 12 }}>
                        <label>{attr} Values (comma separated):</label>
                        <input
                          type="text"
                          value={(attributeValues[attr] || []).join(', ')}
                          onChange={e => {
                            const arr = e.target.value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                            handleAttributeValuesChange(attr, arr);
                          }}
                          placeholder={`e.g. Value1, Value2, Value3`}
                        />
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary" onClick={generateMatrixVariants}>
                      Generate Matrix
                    </button>
                    {matrixVariants.length > 0 && (
                      <table className="matrix-table">
                        <thead>
                          <tr>
                            {variantAttributes.map(attr => (
                              <th key={attr}>{attr}</th>
                            ))}
                            <th>Price</th>
                            <th>Special Price</th>
                            <th>Images</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrixVariants.map((variant, index) => (
                            <tr key={index}>
                              {variantAttributes.map(attr => (
                                <td key={attr}>{variant[attr]}</td>
                              ))}
                              <td>
                                <input
                                  type="number"
                                  value={variant.price}
                                  min="0"
                                  step="0.01"
                                  onChange={e => updateMatrixVariant(index, 'price', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={variant.specialPrice}
                                  min="0"
                                  step="0.01"
                                  onChange={e => updateMatrixVariant(index, 'specialPrice', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  onChange={e => {
                                    const files = Array.from(e.target.files);
                                    updateMatrixVariant(index, 'images', files);
                                  }}
                                />
                                {variant.images && variant.images.length > 0 && (
                                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                    {variant.images.map((img, i) => (
                                      <img
                                        key={i}
                                        src={typeof img === 'string' ? img : URL.createObjectURL(img)}
                                        alt={`Matrix Variant ${index + 1} Image ${i + 1}`}
                                        style={{ width: 40, height: 40, objectFit: 'cover' }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {/* End Matrix Variant UI */}
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
                {showAddModal ? 'Add Product' : 'Update Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Product Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="product-details">
                <div className="product-header">
                  <img src={selectedProduct.images[0] || '/default-product.png'} alt={selectedProduct.name} />
                  <div>
                    <h3>{selectedProduct.name}</h3>
                    <p>SKU: {selectedProduct.sku}</p>
                  </div>
                </div>
                
                <div className="product-info-grid">
                  <div className="info-item">
                    <label>Category:</label>
                    <span>{getCategoryName(selectedProduct.categoryId)}</span>
                  </div>
                  <div className="info-item">
                    <label>Brand:</label>
                    <span>{getBrandName(selectedProduct.brandId)}</span>
                  </div>
                  <div className="info-item">
                    <label>Vendor:</label>
                    <span>{getVendorName(selectedProduct.vendorId)}</span>
                  </div>
                  <div className="info-item">
                    <label>Status:</label>
                    <span className={`status-badge ${selectedProduct.status}`}>
                      {selectedProduct.status}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Regular Price:</label>
                    <span>${selectedProduct.regularPrice}</span>
                  </div>
                  <div className="info-item">
                    <label>Special Price:</label>
                    <span>{selectedProduct.specialPrice ? `$${selectedProduct.specialPrice}` : 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Stock:</label>
                    <span className={`stock-badge ${selectedProduct.stock === 0 ? 'out-of-stock' : selectedProduct.stock <= (selectedProduct.lowStockAlert || 10) ? 'low-stock' : 'in-stock'}`}>
                      {selectedProduct.stock}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Tax:</label>
                    <span>{selectedProduct.tax}%</span>
                  </div>
                </div>

                <div className="product-description">
                  <h4>Description</h4>
                  <p>{selectedProduct.description}</p>
                </div>

                {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                  <div className="product-tags">
                    <h4>Tags</h4>
                    <div className="tags">
                      {selectedProduct.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div className="product-variants">
                    <h4>Variants</h4>
                    <div className="variants-list">
                      {selectedProduct.variants.map((variant, index) => (
                        <div key={index} className="variant-item">
                          <strong>{variant.name}</strong>
                          <span>Options: {variant.options.join(', ')}</span>
                          <span>Price: ${variant.price}</span>
                          <span>Stock: {variant.stock}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProduct.images && selectedProduct.images.length > 0 && (
                  <div className="product-images">
                    <h4>Images</h4>
                    <div className="images-grid">
                      {selectedProduct.images.map((image, index) => (
                        <img key={index} src={image} alt={`Product ${index + 1}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products; 