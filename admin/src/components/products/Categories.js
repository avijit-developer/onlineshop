import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Categories.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
// const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'hierarchy'
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    image: '',
    featured: false,
    sortOrder: 0
  });
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Compress image to <= maxBytes using WebP (preferred) or JPEG fallback
  const compressImageFile = async (file, maxBytes = 150 * 1024, maxWidth = 1200, maxHeight = 1200) => {
    const toDataUrl = (img, type, quality) => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL(type, quality);
    };

    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

    const readFileAsDataUrl = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);

    // Try WebP first, then JPEG
    const tryTypes = ['image/webp', 'image/jpeg'];
    for (const type of tryTypes) {
      let quality = 0.9;
      let bestBlob = null;
      let bestSize = Infinity;
      for (; quality >= 0.4; quality -= 0.1) {
        const outDataUrl = toDataUrl(img, type, quality);
        const res = await fetch(outDataUrl);
        const blob = await res.blob();
        if (blob.size <= maxBytes) {
          const ext = type === 'image/webp' ? 'webp' : 'jpg';
          return new File([blob], `${file.name.split('.')[0]}_compressed.${ext}`, { type });
        }
        if (blob.size < bestSize) {
          bestSize = blob.size;
          bestBlob = blob;
        }
      }
      // if loop ends without return but bestBlob exists under 500KB, use it as fallback
      if (bestBlob && bestBlob.size < 500 * 1024) {
        const ext = type === 'image/webp' ? 'webp' : 'jpg';
        return new File([bestBlob], `${file.name.split('.')[0]}_compressed.${ext}`, { type });
      }
    }
    throw new Error('Unable to compress image under 150 KB');
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };
  const getAuthHeaderOnly = () => {
    const token = localStorage.getItem('adminToken');
    return {
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  useEffect(() => {
    fetchCategories();
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    filterCategories();
  }, [categories, searchTerm]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const qParam = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';
      const res = await fetch(`${API_BASE}/api/v1/categories?parent=all&page=${currentPage}&limit=${itemsPerPage}${qParam}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch categories');

      const items = json.data || [];
      const idToCategory = new Map(items.map(c => [c._id, c]));
      const computeLevel = (cat) => {
        let level = 1; let cur = cat;
        while (cur.parent) {
          level += 1;
          cur = idToCategory.get(cur.parent) || null;
          if (!cur) break;
        }
        return level;
      };
      const mapped = items.map(c => ({
        id: c._id,
        name: c.name,
        description: c.description || '',
        parentId: c.parent || null,
        image: c.image || '',
        featured: !!c.featured,
        sortOrder: c.sortOrder || 0,
        level: computeLevel(c),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));

      setCategories(mapped);
      setFilteredCategories(mapped);
      const totalValue = json?.meta?.total || mapped.length;
      setTotal(totalValue);
      const pagesCount = Math.max(1, Math.ceil(totalValue / itemsPerPage));
      if (currentPage > pagesCount) {
        setCurrentPage(pagesCount);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const filterCategories = () => {
    let filtered = categories;

    if (searchTerm) {
      filtered = filtered.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCategories(filtered);
    setCurrentPage(1);
  };

  const getCategoryLevel = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.level : 0;
  };

  const getAvailableParents = (currentCategoryId = null) => {
    return categories.filter(cat => {
      if (currentCategoryId && (cat.id === currentCategoryId || isDescendant(cat.id, currentCategoryId))) {
        return false;
      }
      const currentLevel = getCategoryLevel(cat.id);
      return currentLevel < 5;
    });
  };

  const isDescendant = (categoryId, ancestorId) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category || !category.parentId) return false;
    if (category.parentId === ancestorId) return true;
    return isDescendant(category.parentId, ancestorId);
  };

  const calculateNewLevel = (parentId) => {
    if (!parentId) return 1;
    const parentLevel = getCategoryLevel(parentId);
    return parentLevel + 1;
  };

  const handleAddCategory = () => {
    setFormData({
      name: '',
      description: '',
      parentId: '',
      image: '',
      featured: false,
      sortOrder: 0
    });
    setImageFile(null);
    setShowAddModal(true);
  };

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      image: category.image || '',
      featured: category.featured || false,
      sortOrder: category.sortOrder || 0
    });
    setImageFile(null);
    setShowEditModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/categories/${categoryId}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Failed to delete category (HTTP ${res.status})`);
        await fetchCategories();
        toast.success('Category deleted successfully');
      } catch (error) {
        toast.error(error.message || 'Failed to delete category');
      }
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
      if (showAddModal && !imageFile) {
        toast.error('Image is required');
        setSubmitting(false);
        return;
      }
      if (imageFile && imageFile.size > 150 * 1024) {
        toast.error('File too large. Max 150 KB allowed');
        setSubmitting(false);
        return;
      }

      // Client-side duplicate sort order check under the same parent
      const parentIdNorm = formData.parentId || null;
      const sortNorm = Number(formData.sortOrder) || 0;
      const conflict = categories.find(c => c.parentId === parentIdNorm && c.sortOrder === sortNorm && (!selectedCategory || c.id !== selectedCategory.id));
      if (conflict) {
        toast.error('Sort Order already used for this parent. Please choose a different rank.');
        setSubmitting(false);
        return;
      }

      const newLevel = calculateNewLevel(formData.parentId);
      if (newLevel > 5) {
        toast.error('Cannot create category beyond 5 levels of hierarchy');
        setSubmitting(false);
        return;
      }

      const fd = new FormData();
      fd.append('name', formData.name);
      fd.append('description', formData.description || '');
      if (formData.parentId) fd.append('parent', formData.parentId);
      fd.append('featured', String(!!formData.featured));
      fd.append('sortOrder', String(sortNorm));

      // Direct upload to Cloudinary first if a file is selected
      if (imageFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(imageFile, 'categories');
        fd.append('imageUrl', imageUrl);
        fd.append('imagePublicId', imagePublicId);
      }

      if (showAddModal) {
        const res = await fetch(`${API_BASE}/api/v1/categories`, {
          method: 'POST',
          headers: getAuthHeaderOnly(),
          body: fd
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Failed to add category (HTTP ${res.status})`);
        toast.success('Category added successfully');
      } else {
        const res = await fetch(`${API_BASE}/api/v1/categories/${selectedCategory.id}`, {
          method: 'PUT',
          headers: getAuthHeaderOnly(),
          body: fd
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Failed to update category (HTTP ${res.status})`);
        toast.success('Category updated successfully');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setImageFile(null);
      await fetchCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to save category');
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 150 * 1024);
        if (compressed.size > 150 * 1024) {
          toast.error('File too large. Max 150 KB allowed');
          return;
        }
        const imageUrl = URL.createObjectURL(compressed);
        setFormData(prev => ({
          ...prev,
          image: imageUrl
        }));
        setImageFile(compressed);
      } catch (err) {
        toast.error(err?.message || 'Failed to process image');
      }
    }
  };

  const toggleFeatured = async (categoryId) => {
    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;
      const res = await fetch(`${API_BASE}/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ featured: !category.featured })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Failed to update featured status (HTTP ${res.status})`);
      await fetchCategories();
      toast.success('Featured status updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update featured status');
    }
  };

  const getParentName = (parentId) => {
    if (!parentId) return 'None';
    const parent = categories.find(cat => cat.id === parentId);
    return parent ? parent.name : 'Unknown';
  };

  const getSubcategories = (categoryId) => {
    return categories.filter(cat => cat.parentId === categoryId);
  };

  const getProductCount = (categoryId) => {
    return Math.floor(Math.random() * 50);
  };

  const toggleExpanded = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryPath = (categoryId) => {
    const category = categories.find(cat => cat.id === parseInt(categoryId));
    if (!category) return '';
    const path = [];
    let current = category;
    while (current) {
      path.unshift(current.name);
      current = current.parentId ? categories.find(cat => cat.id === current.parentId) : null;
    }
    return path.join(' › ');
  };

  const buildCategoryTree = (availableCategories) => {
    const tree = [];
    const categoryMap = {};
    availableCategories.forEach(category => {
      categoryMap[category.id] = { ...category, children: [] };
    });
    availableCategories.forEach(category => {
      if (category.parentId && categoryMap[category.parentId]) {
        categoryMap[category.parentId].children.push(categoryMap[category.id]);
      } else {
        tree.push(categoryMap[category.id]);
      }
    });
    return tree;
  };

  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedCategories.has(node.id);
    return (
      <div key={node.id} className="tree-node" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="tree-node-content">
          {hasChildren && (
            <button
              type="button"
              className={`tree-expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpanded(node.id)}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="tree-spacer"></span>}
          <button
            type="button"
            className={`tree-category-btn ${formData.parentId === node.id.toString() ? 'selected' : ''}`}
            onClick={() => setFormData(prev => ({...prev, parentId: node.id.toString()}))}
          >
            <img 
              src={node.image || '/default-category.png'} 
              alt={node.name} 
              className="tree-category-image" 
            />
            <span className="tree-category-name">{node.name}</span>
            <span className="tree-category-level">Level {node.level}</span>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderCategoryTree = (availableCategories) => {
    const tree = buildCategoryTree(availableCategories);
    if (tree.length === 0) {
      return (
        <div className="empty-tree">
          <p>No parent categories available</p>
        </div>
      );
    }
    return (
      <div className="category-tree-container">
        <div className="tree-header">
          <button
            type="button"
            onClick={() => setExpandedCategories(new Set())}
            className="tree-action-btn"
          >
            Collapse All
          </button>
          <button
            type="button"
            onClick={() => {
              const allIds = new Set(availableCategories.map(cat => cat.id));
              setExpandedCategories(allIds);
            }}
            className="tree-action-btn"
          >
            Expand All
          </button>
        </div>
        <div className="tree-content">
          {tree.map(node => renderTreeNode(node))}
        </div>
      </div>
    );
  };

  const renderHierarchyItem = (category, depth = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasChildren = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const canExpand = hasChildren && category.level < 5;

    return (
      <div key={category.id} className="hierarchy-item" style={{ marginLeft: `${depth * 20}px` }}>
        <div className={`hierarchy-row level-${category.level}`}>
          <div className="hierarchy-content">
            {canExpand && (
              <button 
                className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpanded(category.id)}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <img src={category.image || '/default-category.png'} alt={category.name} className="category-image" />
            <div className="category-details">
              <span className="category-name">{category.name}</span>
              <span className="category-description">{category.description}</span>
              <span className="category-level">Level {category.level}</span>
            </div>
            {category.featured && <span className="featured-indicator">★</span>}
            <div className="hierarchy-actions">
              <button onClick={() => handleEditCategory(category)} className="btn btn-info btn-sm">Edit</button>
              <button onClick={() => toggleFeatured(category.id)} className={`btn btn-sm ${category.featured ? 'btn-warning' : 'btn-success'}`}>
                {category.featured ? 'Unfeature' : 'Feature'}
              </button>
              <button onClick={() => handleDeleteCategory(category.id)} className="btn btn-danger btn-sm">Delete</button>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="hierarchy-children">
            {subcategories.map(subCategory => renderHierarchyItem(subCategory, depth + 1))}
          </div>
        )}
      </div>
    );
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

  const uploadToCloudinary = async (file, subfolder = 'categories') => {
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

  const currentCategories = categories;
  const pagesCount = Math.max(1, Math.ceil(total / itemsPerPage));

  if (loading) {
    return <div className="loading">Loading categories...</div>;
  }

  return (
    <div className="categories-container">
      <div className="page-header">
        <h1>Category Management</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('table')}
            >
              Table View
            </button>
            <button 
              className={`btn ${viewMode === 'hierarchy' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('hierarchy')}
            >
              Hierarchy View
            </button>
          </div>
          <button onClick={handleAddCategory} className="btn btn-primary">
            Add Category
          </button>
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Categories</h3>
          <p>{categories.length}</p>
        </div>
        <div className="stat-card">
          <h3>Parent Categories</h3>
          <p>{categories.filter(cat => !cat.parentId).length}</p>
        </div>
        <div className="stat-card">
          <h3>Subcategories</h3>
          <p>{categories.filter(cat => cat.parentId).length}</p>
        </div>
        <div className="stat-card">
          <h3>Featured Categories</h3>
          <p>{categories.filter(cat => cat.featured).length}</p>
        </div>
        <div className="stat-card">
          <h3>Max Depth</h3>
          <p>{Math.max(0, ...categories.map(cat => cat.level || 0))}</p>
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          <div className="categories-table-container">
            <table className="categories-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Level</th>
                  <th>Parent</th>
                  <th>Products</th>
                  <th>Subcategories</th>
                  <th>Featured</th>
                  <th>Sort Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="category-info">
                        <img src={category.image || '/default-category.png'} alt={category.name} className="category-image" />
                        <div>
                          <strong>{category.name}</strong>
                          <small>{category.description}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`level-badge level-${category.level}`}>
                        Level {category.level}
                      </span>
                    </td>
                    <td>{getParentName(category.parentId)}</td>
                    <td>{getProductCount(category.id)}</td>
                    <td>{getSubcategories(category.id).length}</td>
                    <td>
                      <span className={`featured-badge ${category.featured ? 'featured' : 'not-featured'}`}>
                        {category.featured ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{category.sortOrder || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="btn btn-info btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleFeatured(category.id)}
                          className={`btn btn-sm ${category.featured ? 'btn-warning' : 'btn-success'}`}
                        >
                          {category.featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
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

          {(
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="btn btn-secondary"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary"
              >
                Prev
              </button>
              <span className="page-info">Page {currentPage} of {pagesCount}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagesCount, prev + 1))}
                disabled={currentPage >= pagesCount}
                className="btn btn-secondary"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(pagesCount)}
                disabled={currentPage >= pagesCount}
                className="btn btn-secondary"
              >
                Last
              </button>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="page-size-select"
                style={{ marginLeft: 8 }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}
        </>
      ) : (
        <div className="hierarchy-view">
          <div className="hierarchy-controls">
            <button 
              onClick={() => setExpandedCategories(new Set())}
              className="btn btn-secondary btn-sm"
            >
              Collapse All
            </button>
            <button 
              onClick={() => {
                const allIds = new Set(categories.map(cat => cat.id));
                setExpandedCategories(allIds);
              }}
              className="btn btn-secondary btn-sm"
            >
              Expand All
            </button>
          </div>
          <div className="hierarchy-tree">
            {categories
              .filter(cat => !cat.parentId)
              .map(parentCategory => renderHierarchyItem(parentCategory))}
          </div>
        </div>
      )}

      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>{showAddModal ? 'Add New Category' : 'Edit Category'}</h2>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Parent Category</label>
                  <div className="parent-category-selector">
                    <div className="selected-parent">
                      {formData.parentId ? (
                        <div className="selected-category">
                          <span className="category-path">
                            {getCategoryPath(formData.parentId)}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({...prev, parentId: ''}))}
                            className="clear-selection"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span className="no-parent-selected">No Parent (Top Level Category)</span>
                      )}
                    </div>
                    <div className="category-tree">
                      {renderCategoryTree(getAvailableParents(selectedCategory?.id))}
                    </div>
                  </div>
                  <small className="form-help">
                    {formData.parentId ? `New level will be: ${calculateNewLevel(formData.parentId)}` : 'This will be a top-level category (Level 1)'}
                  </small>
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
                  <label>Featured Category</label>
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
                  <label>Category Image {showAddModal && <span style={{color:'#e53e3e'}}>*</span>}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <small className="form-help">Upload JPG/PNG/WebP/GIF up to 150 KB (auto-compressed)</small>
                  {formData.image && (
                    <div className="image-preview">
                      <img src={formData.image} alt="Category preview" />
                    </div>
                  )}
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
                {submitting ? (showAddModal ? 'Saving...' : 'Updating...') : (showAddModal ? 'Add Category' : 'Update Category')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories; 