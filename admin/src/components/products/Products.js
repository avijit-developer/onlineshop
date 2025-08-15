import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Products.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Products = () => {
  // Dynamic matrix variant state
  const [variantAttributes, setVariantAttributes] = useState([]); // e.g. ['Attribute1', 'Attribute2']
  const [attributeValues, setAttributeValues] = useState({}); // { Attribute1: ['A', 'B'], Attribute2: ['X', 'Y'] }
  const [matrixVariants, setMatrixVariants] = useState([]);
  const [variantAttributesInput, setVariantAttributesInput] = useState('');
  const [attributeValuesInput, setAttributeValuesInput] = useState({});

  const removeMatrixVariant = (index) => {
    setMatrixVariants(prev => prev.filter((_, i) => i !== index));
  };
  const removeMatrixVariantImage = (variantIndex, imageIndex) => {
    setMatrixVariants(prev => prev.map((v, i) => i === variantIndex ? { ...v, images: (v.images || []).filter((_, j) => j !== imageIndex) } : v));
  };

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
      return { ...obj, sku: '', price: '', specialPrice: '', stock: '', images: [] };
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

  // Cloudinary Direct Upload helpers (for variant images)
  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };
  const getUploadSignature = async (subfolder) => {
    const res = await fetch(`${API_BASE}/api/v1/uploads/signature`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: subfolder })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to get upload signature');
    return json.data;
  };
  const uploadToCloudinary = async (file, subfolder = 'products/variants') => {
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
      setLoading(true);
      // Fetch products
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
      if (vendorFilter && vendorFilter !== 'all') params.append('vendor', vendorFilter);
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));

      const [prodRes, catRes, venRes, brRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/products?${params.toString()}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/v1/categories?parent=all&page=1&limit=1000`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/v1/vendors?page=1&limit=1000`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/v1/brands?page=1&limit=1000`, { headers: getAuthHeaders() })
      ]);

      const [prodJson, catJson, venJson, brJson] = await Promise.all([
        prodRes.json(), catRes.json(), venRes.json(), brRes.json()
      ]);

      if (!prodRes.ok) throw new Error(prodJson?.message || 'Failed to fetch products');
      if (!catRes.ok) throw new Error(catJson?.message || 'Failed to fetch categories');
      if (!venRes.ok) throw new Error(venJson?.message || 'Failed to fetch vendors');
      if (!brRes.ok) throw new Error(brJson?.message || 'Failed to fetch brands');

      setProducts(prodJson.data || []);
      setCategories((catJson.data || []).map(c => ({ id: c._id, name: c.name })));
      setVendors((venJson.data || []).map(v => ({ id: v._id, companyName: v.companyName })));
      setBrands((brJson.data || []).map(b => ({ id: b._id, name: b.name })));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(error.message || 'Failed to load data');
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;
    if (searchTerm) {
      filtered = filtered.filter(product =>
        (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => product.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => String(product.category) === String(categoryFilter));
    }
    if (vendorFilter !== 'all') {
      filtered = filtered.filter(product => String(product.vendor) === String(vendorFilter));
    }
    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const handleStatusChange = async (productId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update product status');
      toast.success(`Product ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to update product status');
    }
  };

  const handleEnableToggle = async (product, isEnabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${product._id || product.id}/enabled`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled: isEnabled })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update product status');
      toast.success(`Product ${isEnabled ? 'enabled' : 'disabled'} successfully`);
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to update product status');
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
      name: product.name || '',
      description: product.description || '',
      categoryId: product.category || '',
      brandId: product.brand || '',
      vendorId: product.vendor || '',
      regularPrice: product.regularPrice ?? '',
      specialPrice: product.specialPrice ?? '',
      tax: product.tax ?? '',
      stock: product.stock ?? '',
      sku: product.sku || '',
      tags: (product.tags || []).join(', '),
      seoTitle: '',
      seoDescription: '',
      images: product.images || [],
      variants: product.variants || []
    });
    setShowEditModal(true);
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        category: formData.categoryId,
        brand: formData.brandId,
        vendor: formData.vendorId,
        regularPrice: Number(formData.regularPrice) || 0,
        specialPrice: formData.specialPrice !== '' ? Number(formData.specialPrice) : undefined,
        tax: formData.tax !== '' ? Number(formData.tax) : undefined,
        stock: formData.stock !== '' ? Number(formData.stock) : undefined,
        sku: formData.sku?.trim() || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        images: formData.images || [],
        imagePublicIds: [],
        variants: matrixVariants.map(v => ({
          attributes: Object.fromEntries(Object.entries(v).filter(([k]) => variantAttributes.includes(k))),
          sku: (v.sku || '').trim(),
          price: v.price !== '' && v.price !== undefined ? Number(v.price) : undefined,
          specialPrice: v.specialPrice !== '' && v.specialPrice !== undefined ? Number(v.specialPrice) : undefined,
          stock: v.stock !== '' && v.stock !== undefined ? Number(v.stock) : 0,
          images: (v.images || []).map(img => typeof img === 'string' ? img : img.imageUrl) // Convert File objects to URLs
        }))
      };

      if (payload.variants.length > 0) {
        for (const v of payload.variants) {
          if (!v.sku || v.price === undefined) {
            toast.error('Each variant must have SKU and Price');
            return;
          }
        }
      }

      if (showAddModal) {
        const res = await fetch(`${API_BASE}/api/v1/products`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to add product');
        toast.success('Product added successfully');
      } else {
        const id = selectedProduct?._id || selectedProduct?.id;
        const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to update product');
        toast.success('Product updated successfully');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to save product');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const uploads = [];
      for (const f of files) {
        const { imageUrl } = await uploadToCloudinary(f, 'products');
        uploads.push(imageUrl);
      }
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploads]
      }));
    } catch (err) {
      toast.error(err?.message || 'Failed to upload images');
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const id = product._id || product.id;
      const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete product');
      toast.success('Product deleted');
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete product');
    }
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
    const category = categories.find(c => String(c.id) === String(categoryId));
    return category ? category.name : 'N/A';
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => String(v.id) === String(vendorId));
    return vendor ? vendor.companyName : 'N/A';
  };

  const getBrandName = (brandId) => {
    const brand = brands.find(b => String(b.id) === String(brandId));
    return brand ? brand.name : 'N/A';
  };

  // Pagination (API-like)
  const total = filteredProducts.length; // fallback until backend returns totals per filter
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="products-container">
      <div className="page-header">
        <h1>Product Management</h1>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-filter-container" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); fetchData(); } }}
              className="search-input"
              style={{ minWidth: 260 }}
            />
            <button className="btn btn-primary" onClick={() => { setCurrentPage(1); fetchData(); }}>Search</button>
            {searchTerm && (
              <button className="btn btn-secondary" onClick={() => { setSearchTerm(''); setCurrentPage(1); fetchData(); }}>Clear</button>
            )}
          </div>
          <button onClick={handleAddProduct} className="btn btn-primary">Add Product</button>
          
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); fetchData(); }}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); fetchData(); }}
            className="filter-select"
          >
            <option value="all">All Vendors</option>
            {vendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>{vendor.companyName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Products</h3>
          <p>{products.length}</p>
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
              <th>Brand</th>
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
                <td>{getCategoryName(product.category || product.categoryId)}</td>
                <td>{getBrandName(product.brand || product.brandId)}</td>
                <td>{getVendorName(product.vendor || product.vendorId)}</td>
                {/* Use correct vendor field */}
                
                <td>
                  <div className="price-info">
                    <span className="regular-price">${product.regularPrice}</span>
                    {product.specialPrice && (
                      <span className="special-price">${product.specialPrice}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`stock-badge ${product.stock === 0 ? 'out-of-stock' : 'in-stock'}`}>
                    {product.stock}
                  </span>
                </td>
                <td>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={!!product.enabled} onChange={(e) => handleEnableToggle(product, e.target.checked)} />
                    <span className="slider" />
                  </label>
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
                    <button
                      onClick={() => handleDeleteProduct(product)}
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

      {/* Pagination (same style as Categories) */}
      <div className="pagination">
        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="btn btn-secondary">First</button>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-secondary">Prev</button>
        <span className="page-info">Page {currentPage} of {totalPages}</span>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="btn btn-secondary">Next</button>
        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="btn btn-secondary">Last</button>
        <select value={itemsPerPage} onChange={(e) => { /* itemsPerPage is const earlier; adjust to state if needed */ }} className="page-size-select" style={{ marginLeft: 8 }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

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
                        value={variantAttributesInput}
                        onChange={e => {
                          const raw = e.target.value;
                          setVariantAttributesInput(raw);
                          const arr = raw.split(',').map(v => v.trim()).filter(v => v.length > 0);
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
                          value={attributeValuesInput[attr] !== undefined ? attributeValuesInput[attr] : (attributeValues[attr] || []).join(', ')}
                          onChange={e => {
                            const raw = e.target.value;
                            setAttributeValuesInput(prev => ({ ...prev, [attr]: raw }));
                            const arr = raw.split(',').map(v => v.trim()).filter(v => v.length > 0);
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
                            <th>SKU</th>
                            <th>Price</th>
                            <th>Special Price</th>
                            <th>Stock Qty</th>
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
                                  type="text"
                                  value={variant.sku || ''}
                                  onChange={e => updateMatrixVariant(index, 'sku', e.target.value)}
                                  placeholder="SKU"
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={variant.price}
                                  min="0"
                                  step="0.01"
                                  onChange={e => updateMatrixVariant(index, 'price', e.target.value)}
                                  required
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
                                  type="number"
                                  value={variant.stock || ''}
                                  min="0"
                                  onChange={e => updateMatrixVariant(index, 'stock', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  onChange={async e => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length === 0) return;
                                    try {
                                      const uploads = [];
                                      for (const f of files) {
                                        const { imageUrl } = await uploadToCloudinary(f, 'products/variants');
                                        uploads.push(imageUrl);
                                      }
                                      const merged = [...(variant.images || []), ...uploads];
                                      updateMatrixVariant(index, 'images', merged);
                                    } catch (err) {
                                      toast.error(err?.message || 'Failed to upload images');
                                    }
                                  }}
                                />
                                {variant.images && variant.images.length > 0 && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    {variant.images.map((img, i) => (
                                      <div key={i} style={{ position: 'relative' }}>
                                        <img
                                          src={img}
                                          alt={`Matrix Variant ${index + 1} Image ${i + 1}`}
                                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeMatrixVariantImage(index, i)}
                                          className="btn btn-danger btn-xs"
                                          style={{ position: 'absolute', top: -6, right: -6 }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ marginTop: 8 }}>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMatrixVariant(index)}>Remove Row</button>
                                </div>
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
                    <span>{getCategoryName(selectedProduct.category)}</span>
                  </div>
                  <div className="info-item">
                    <label>Brand:</label>
                    <span>{getBrandName(selectedProduct.brand)}</span>
                  </div>
                  <div className="info-item">
                    <label>Vendor:</label>
                    <span>{getVendorName(selectedProduct.vendor)}</span>
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
                    <span className={`stock-badge ${selectedProduct.stock === 0 ? 'out-of-stock' : 'in-stock'}`}>
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
                          <div>
                            <strong>SKU:</strong> {variant.sku || 'N/A'}
                          </div>
                          <div>
                            <strong>Attributes:</strong>{' '}
                            {variant.attributes ? (
                              <>
                                {Array.from(variant.attributes instanceof Map ? variant.attributes.entries() : Object.entries(variant.attributes)).map(([k, v], i) => (
                                  <span key={i}>{k}: {v}{i < Object.entries(variant.attributes).length - 1 ? ', ' : ''}</span>
                                ))}
                              </>
                            ) : 'N/A'}
                          </div>
                          <div>
                            <strong>Price:</strong> {variant.price != null ? `$${variant.price}` : 'N/A'}
                          </div>
                          <div>
                            <strong>Stock:</strong> {variant.stock ?? 0}
                          </div>
                          {variant.images && variant.images.length > 0 && (
                            <div className="variant-images">
                              <h5>Images</h5>
                              <div className="images-grid">
                                {variant.images.map((image, imgIndex) => (
                                  <img key={imgIndex} src={image} alt={`Variant ${index + 1} Image ${imgIndex + 1}`} />
                                ))}
                              </div>
                            </div>
                          )}
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