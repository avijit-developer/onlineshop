import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Categories.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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
    filterCategories();
  }, [categories, searchTerm]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/categories?parent=all&limit=1000`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch categories');

      // Map backend categories to UI structure with computed level and parentId
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
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const filterCategories = () => {
    let filtered = categories;

    // Search filter
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
        if (!res.ok) throw new Error(json?.message || 'Failed to delete category');
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
      const newLevel = calculateNewLevel(formData.parentId);
      if (newLevel > 5) {
        toast.error('Cannot create category beyond 5 levels of hierarchy');
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        parent: formData.parentId || null,
        image: formData.image,
        featured: formData.featured,
        sortOrder: Number(formData.sortOrder) || 0
      };

      if (showAddModal) {
        const res = await fetch(`${API_BASE}/api/v1/categories`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Failed to add category');
        toast.success('Category added successfully');
      } else {
        const res = await fetch(`${API_BASE}/api/v1/categories/${selectedCategory.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Failed to update category');
        toast.success('Category updated successfully');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      await fetchCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to save category');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        image: imageUrl
      }));
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
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to update featured status');
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCategories = filteredCategories.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

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
                  <label>Category Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
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
              <button onClick={handleSubmit} className="btn btn-primary">
                {showAddModal ? 'Add Category' : 'Update Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories; 