import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Categories.css';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
// const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
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
  const [filterEnabled, setFilterEnabled] = useState('all'); // all | enabled | disabled
  const [filterFeatured, setFilterFeatured] = useState('all'); // all | featured | not
  const [groupByParent, setGroupByParent] = useState(true);
  const [expandedTableIds, setExpandedTableIds] = useState(new Set());
  const [expandedSubIds, setExpandedSubIds] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    image: '',
    featured: false,
    sortOrder: 0,
    enabled: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');

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
    fetchAllCategories();
  }, []);

  const fetchAllCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/categories?parent=all&limit=10000`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to fetch all categories');
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
        enabled: !!c.enabled,
        level: computeLevel(c),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));
      setAllCategories(mapped);
    } catch (e) {
      // ignore
    }
  };

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
        enabled: !!c.enabled,
        level: computeLevel(c),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));

      setCategories(mapped);
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

  const getCategoryLevel = (categoryId) => {
    const source = allCategories.length > 0 ? allCategories : categories;
    const category = source.find(cat => cat.id === categoryId);
    return category ? category.level : 0;
  };

  const getAvailableParents = (currentCategoryId = null) => {
    const source = allCategories.length > 0 ? allCategories : categories;
    return source.filter(cat => {
      if (currentCategoryId && (cat.id === currentCategoryId || isDescendant(cat.id, currentCategoryId))) {
        return false;
      }
      const currentLevel = getCategoryLevel(cat.id);
      return currentLevel < 5;
    });
  };

  const isDescendant = (categoryId, ancestorId) => {
    const source = allCategories.length > 0 ? allCategories : categories;
    const category = source.find(cat => cat.id === categoryId);
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
      sortOrder: 0,
      enabled: true
    });
    setImageFile(null);
    setShowAddModal(true);
  };

  const handleAddChild = (parentCategory) => {
    setSelectedCategory(null);
    setFormData({
      name: '',
      description: '',
      parentId: parentCategory?.id || '',
      image: '',
      featured: false,
      sortOrder: 0,
      enabled: true
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
      sortOrder: category.sortOrder || 0,
      enabled: category.enabled || true
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
        await fetchAllCategories();
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

      // Store current page to restore after operation
      const currentPageBefore = currentPage;

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

      // Client-side duplicate sort order check under the same parent (removed as per request)
      const sortNorm = Number(formData.sortOrder) || 0;

      const newLevel = calculateNewLevel(formData.parentId);
      if (newLevel > 5) {
        toast.error('Cannot create category beyond 5 levels of hierarchy');
        setSubmitting(false);
        return;
      }

      const fd = new FormData();
      fd.append('name', formData.name);
      fd.append('description', formData.description || '');
      fd.append('parent', formData.parentId || '');
      fd.append('featured', String(!!formData.featured));
      fd.append('sortOrder', String(sortNorm));
      fd.append('enabled', String(!!formData.enabled));

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
      
      // Restore the page position after operation
      await fetchCategories();
      await fetchAllCategories();
      setCurrentPage(currentPageBefore);
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

  const toggleEnabled = async (categoryId) => {
    try {
      // Store current page to restore after operation
      const currentPageBefore = currentPage;
      
      const res = await fetch(`${API_BASE}/api/v1/categories/${categoryId}/toggle-enabled`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || 'Failed to toggle enabled status');
      }
      
      await fetchCategories();
      await fetchAllCategories();
      // Restore the page position after operation
      setCurrentPage(currentPageBefore);
      toast.success('Category status updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to toggle enabled status');
    }
  };

  const getParentName = (parentId) => {
    if (!parentId) return 'None';
    const source = allCategories.length > 0 ? allCategories : categories;
    const parent = source.find(cat => cat.id === parentId);
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
    if (!categoryId) return '';
    const source = allCategories.length > 0 ? allCategories : categories;
    const category = source.find(cat => cat.id === categoryId);
    if (!category) return '';
    const path = [];
    let current = category;
    while (current) {
      path.unshift(current.name);
      current = current.parentId ? source.find(cat => cat.id === current.parentId) : null;
    }
    return path.join(' › ');
  };

  const buildCategoryTree = (availableCategories) => {
    const map = new Map();
    const source = allCategories.length > 0 ? allCategories : categories;
    availableCategories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });
    const tree = [];
    availableCategories.forEach(cat => {
      const node = map.get(cat.id);
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(node);
      } else {
        tree.push(node);
      }
    });
    // Ensure children ordering by sortOrder then name
    const sortNodes = (nodes) => {
      nodes.sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0) || a.name.localeCompare(b.name));
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(tree);
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
              <div className="toggle-container">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={category.enabled}
                    onChange={() => toggleEnabled(category.id)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">{category.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
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
  const filteredCategories = currentCategories.filter(cat => {
    const enabledOk = filterEnabled === 'all' || (filterEnabled === 'enabled' ? cat.enabled : !cat.enabled);
    const featuredOk = filterFeatured === 'all' || (filterFeatured === 'featured' ? cat.featured : !cat.featured);
    return enabledOk && featuredOk;
  });
  // Build a flattened, logically grouped list (DFS by parent)
  const sourceAll = (allCategories && allCategories.length > 0) ? allCategories : categories;
  const idToNode = new Map(sourceAll.map(c => [c.id, { ...c, children: [] }]));
  idToNode.forEach((node) => {
    if (node.parentId && idToNode.has(node.parentId)) {
      idToNode.get(node.parentId).children.push(node);
    }
  });
  const sortNodes = (nodes) => nodes.sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0) || a.name.localeCompare(b.name));
  idToNode.forEach(n => sortNodes(n.children));

  const matchesFilters = (cat) => {
    const enabledOk = filterEnabled === 'all' || (filterEnabled === 'enabled' ? cat.enabled : !cat.enabled);
    const featuredOk = filterFeatured === 'all' || (filterFeatured === 'featured' ? cat.featured : !cat.featured);
    const searchOk = !searchTerm || (cat.name?.toLowerCase().includes(searchTerm.toLowerCase()) || (cat.description||'').toLowerCase().includes(searchTerm.toLowerCase()));
    return enabledOk && featuredOk && searchOk;
  };

  const includeSet = new Set();
  if (groupByParent) {
    // Mark nodes matching filters and include their ancestors to preserve logical structure
    sourceAll.forEach(cat => {
      if (matchesFilters(cat)) {
        let cur = cat;
        while (cur) {
          includeSet.add(cur.id);
          cur = cur.parentId ? idToNode.get(cur.parentId) : null;
        }
      }
    });
  }

  const roots = [];
  idToNode.forEach(node => {
    const isRoot = !node.parentId || !idToNode.has(node.parentId);
    if (isRoot) roots.push(node);
  });
  sortNodes(roots);

  const visibleFlattened = [];
  const dfsVisible = (node, depth) => {
    const shouldInclude = groupByParent ? includeSet.has(node.id) : matchesFilters(node);
    if (!shouldInclude) return;
    visibleFlattened.push({ ...node, displayDepth: depth });
    const isExpanded = expandedTableIds.has(node.id);
    if (groupByParent && !isExpanded) return; // collapsed: do not show children
    node.children.forEach(child => dfsVisible(child, depth + 1));
  };
  roots.forEach(r => dfsVisible(r, 0));

  // For grouped view, paginate by included roots
  const includedRoots = roots.filter(r => includeSet.has(r.id));
  const displayTotal = groupByParent ? includedRoots.length : filteredCategories.length;
  const pagesCount = Math.max(1, Math.ceil(displayTotal / itemsPerPage));

  // Build display list with placeholders to keep consistent row count
  const displayCategories = (() => {
    const start = (currentPage - 1) * itemsPerPage;
    const rows = groupByParent ? includedRoots.slice(start, start + itemsPerPage).map(r => ({ ...r, displayDepth: 0 })) : (() => {
      const tmp = [...filteredCategories];
      const deficit = Math.max(0, itemsPerPage - tmp.length);
      for (let i = 0; i < deficit; i++) { tmp.push({ id: `placeholder-${i}`, isPlaceholder: true }); }
      return tmp;
    })();
    const deficit = groupByParent ? 0 : Math.max(0, itemsPerPage - rows.length);
    for (let i = 0; i < deficit; i++) {
      rows.push({ id: `placeholder-${i}`, isPlaceholder: true });
    }
    return rows;
  })();

  const toggleRowExpanded = (id) => {
    const next = new Set(expandedTableIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedTableIds(next);
  };

  const expandAllVisible = () => {
    const next = new Set();
    // expand every node that has children and is included by filters
    idToNode.forEach((n) => {
      const include = groupByParent ? includeSet.has(n.id) : matchesFilters(n);
      if (include && n.children && n.children.length > 0) next.add(n.id);
    });
    setExpandedTableIds(next);
  };

  const collapseAll = () => setExpandedTableIds(new Set());

  // Render subgroup inside a full-width row under parent
  const renderSubgroup = (parentNode) => {
    const lines = [];
    const toggleSub = (id) => {
      const next = new Set(expandedSubIds);
      next.has(id) ? next.delete(id) : next.add(id);
      setExpandedSubIds(next);
    };
    const walk = (node, depth) => {
      const include = includeSet.has(node.id);
      const isParent = node.id === parentNode.id;
      if (!isParent && include) {
        const hasChildren = (node.children || []).some(ch => includeSet.has(ch.id));
        const isLevel2 = (node.level === (parentNode.level + 1));
        const canToggle = isLevel2 && hasChildren;
        const expanded = expandedSubIds.has(node.id);
        lines.push(
          <div key={node.id} className={`subitem depth-${depth}`} style={{ marginLeft: depth * 16 }}>
            {canToggle && (
              <button
                type="button"
                className={`expand-btn ${expanded ? 'expanded' : ''}`}
                onClick={() => toggleSub(node.id)}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? '▼' : '▶'}
              </button>
            )}
            {!canToggle && <span style={{ width: 20 }} />}
            <img src={node.image || '/default-category.png'} alt={node.name} className="category-image" />
            <div className="subitem-info">
              <strong>{node.name}</strong>
              {node.description && <small>{node.description}</small>}
            </div>
            <span className={`level-badge level-${node.level}`}>L{node.level}</span>
            {node.featured && <span className="featured-indicator">★</span>}
            <div className="toggle-container" style={{ marginLeft: 'auto' }}>
              <label className="toggle-switch">
                <input type="checkbox" checked={!!node.enabled} onChange={() => toggleEnabled(node.id)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => handleAddChild(node)}>Add Sub</button>
            <button className="btn btn-info btn-sm" onClick={() => handleEditCategory(node)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(node.id)}>Delete</button>
          </div>
        );
        if (canToggle && !expanded) {
          return; // hide deeper levels until expanded
        }
      }
      node.children.forEach(child => walk(child, depth + 1));
    };
    const count = (parentNode.children || []).filter(ch => includeSet.has(ch.id)).length;
    walk(parentNode, 0);
    return (
      <div className="subgroup-wrap">
        <div className="subgroup-header">
          <span>Subcategories ({count})</span>
        </div>
        <div className="subgroup-container">{lines.length ? lines : <div className="subitem empty">No subcategories</div>}</div>
      </div>
    );
  };

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
          {viewMode === 'table' && (
            <label className="group-toggle">
              <input type="checkbox" checked={groupByParent} onChange={e => { setGroupByParent(e.target.checked); setCurrentPage(1); }} />
              <span>Group by parent</span>
            </label>
          )}
          {viewMode === 'table' && groupByParent && (
            <div className="group-toggle" style={{ marginLeft: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={expandAllVisible}>Expand All</button>
              <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
            </div>
          )}
          <button onClick={handleAddCategory} className="btn btn-primary">
            Add Category
          </button>
          <div className="search-filter-container">
            <div className="search-group">
              <input
                type="text"
                placeholder="Search categories..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearchTerm(pendingSearch.trim()); setCurrentPage(1); } }}
                className="search-input"
              />
              <button className="btn btn-primary" onClick={() => { setSearchTerm(pendingSearch.trim()); setCurrentPage(1); }}>Search</button>
              {searchTerm && (
                <button className="btn btn-secondary" onClick={() => { setPendingSearch(''); setSearchTerm(''); setCurrentPage(1); }}>Clear</button>
              )}
              <select
                value={filterEnabled}
                onChange={(e) => { setFilterEnabled(e.target.value); setCurrentPage(1); }}
                className="quick-filter-select"
                title="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <select
                value={filterFeatured}
                onChange={(e) => { setFilterFeatured(e.target.value); setCurrentPage(1); }}
                className="quick-filter-select"
                title="Filter by featured"
              >
                <option value="all">All</option>
                <option value="featured">Featured</option>
                <option value="not">Not Featured</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Categories</h3>
          <p>{total}</p>
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
          <h3>Enabled Categories</h3>
          <p>{categories.filter(cat => cat.enabled).length}</p>
        </div>
        <div className="stat-card">
          <h3>Disabled Categories</h3>
          <p>{categories.filter(cat => !cat.enabled).length}</p>
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
                  <th>Type</th>
                  <th>Level</th>
                  <th>Parent</th>
                  <th>Path</th>
                  <th>Subcategories</th>
                  <th>Featured</th>
                  <th>Enabled</th>
                  <th>Sort Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayCategories.map((category) => (
                  <React.Fragment key={category.id}>
                  <tr>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      <div className="category-info">
                        {!category.isPlaceholder ? (
                          <>
                            <img src={category.image || '/default-category.png'} alt={category.name} className="category-image" />
                            <div style={{ paddingLeft: (category.displayDepth || 0) * 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {groupByParent && (idToNode.get(category.id)?.children?.length > 0) && (
                                <button
                                  type="button"
                                  className={`expand-btn ${expandedTableIds.has(category.id) ? 'expanded' : ''}`}
                                  onClick={() => toggleRowExpanded(category.id)}
                                  title={expandedTableIds.has(category.id) ? 'Collapse' : 'Expand'}
                                >
                                  {expandedTableIds.has(category.id) ? '▼' : '▶'}
                                </button>
                              )}
                              <strong>{category.name}</strong>
                              <small>{category.description}</small>
                            </div>
                          </>
                        ) : (
                          <div className="placeholder-bar" />
                        )}
                      </div>
                    </td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      {!category.isPlaceholder ? (
                        <span className={`type-badge ${category.parentId ? 'sub' : 'parent'}`}>
                          {category.parentId ? 'Sub' : 'Parent'}
                        </span>
                      ) : ''}
                    </td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      {!category.isPlaceholder ? (
                        <span className={`level-badge level-${category.level}`}>
                          Level {category.level}
                        </span>
                      ) : (
                        <div className="placeholder-dot" />
                      )}
                    </td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>{!category.isPlaceholder ? getParentName(category.parentId) : ''}</td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      {!category.isPlaceholder ? (
                        <small className="path-text">{getCategoryPath(category.id)}</small>
                      ) : ''}
                    </td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>{!category.isPlaceholder ? getSubcategories(category.id).length : ''}</td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      {!category.isPlaceholder ? (
                        <span className={`featured-badge ${category.featured ? 'featured' : 'not-featured'}`}>
                          {category.featured ? 'Yes' : 'No'}
                        </span>
                      ) : ''}
                    </td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      {!category.isPlaceholder ? (
                        <div className="toggle-container">
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={category.enabled}
                              onChange={() => toggleEnabled(category.id)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                          <span className="toggle-label">{category.enabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      ) : ''}
                    </td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>{!category.isPlaceholder ? (category.sortOrder || 0) : ''}</td>
                    <td className={category.isPlaceholder ? 'placeholder-cell' : ''}>
                      {!category.isPlaceholder ? (
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="btn btn-info btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleAddChild(category)}
                            className="btn btn-primary btn-sm"
                          >
                            Add Sub
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {groupByParent && expandedTableIds.has(category.id) && (idToNode.get(category.id)?.children?.length > 0) && (
                    <tr className="subgroup-row">
                      <td colSpan={10}>
                        {renderSubgroup(idToNode.get(category.id))}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

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
                <div className="form-group">
                  <label>Enabled</label>
                  <div className="toggle-container">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="enabled"
                        checked={formData.enabled}
                        onChange={handleInputChange}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="toggle-label">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
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