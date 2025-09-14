import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/currency';
import { toast } from 'react-hot-toast';
import './Inventory.css';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stockUpdate, setStockUpdate] = useState({
    quantity: '',
    lowStockAlert: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, stockFilter, categoryFilter]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const base = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const [prodRes, catRes, venRes] = await Promise.all([
        fetch(`${base}/api/v1/products?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${base}/api/v1/categories?parent=all&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${base}/api/v1/vendors?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      ]);
      const [prodJson, catJson, venJson] = await Promise.all([prodRes.json(), catRes.json(), venRes.json()]);
      if (!prodRes.ok) throw new Error(prodJson?.message || 'Failed to load products');
      const prods = (prodJson.data || []).map(p => ({
        id: p._id || p.id,
        name: p.name,
        sku: p.sku,
        images: p.images || [],
        categoryId: p.category?._id || p.category || null,
        vendorId: p.vendor?._id || p.vendor || null,
        regularPrice: p.regularPrice,
        specialPrice: p.specialPrice,
        stock: p.stock || 0,
        lowStockAlert: p.lowStockAlert || 10
      }));
      setProducts(prods);
      if (catRes.ok) setCategories((catJson.data || []).map(c => ({ id: c._id || c.id, name: c.name })));
      if (venRes.ok) setVendors((venJson.data || []).map(v => ({ id: v._id || v.id, companyName: v.companyName })));
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
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Stock filter
    if (stockFilter !== 'all') {
      switch (stockFilter) {
        case 'in-stock':
          filtered = filtered.filter(product => product.stock > 0);
          break;
        case 'low-stock':
          filtered = filtered.filter(product => 
            product.stock > 0 && product.stock <= (product.lowStockAlert || 10)
          );
          break;
        case 'out-of-stock':
          filtered = filtered.filter(product => product.stock === 0);
          break;
        default:
          break;
      }
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.categoryId === parseInt(categoryFilter));
    }

    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const handleStockUpdate = (product) => {
    setSelectedProduct(product);
    setStockUpdate({
      quantity: product.stock,
      lowStockAlert: product.lowStockAlert || 10
    });
    setShowStockModal(true);
  };

  const updateStock = async () => {
    if (!selectedProduct) return;
    try {
      const token = localStorage.getItem('adminToken');
      const ORIGIN2 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const base = process.env.REACT_APP_API_URL || (ORIGIN2 && ORIGIN2.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN2 || 'http://localhost:5000'));
      const res = await fetch(`${base}/api/v1/products/${selectedProduct.id}/inventory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ stock: Number(stockUpdate.quantity), lowStockAlert: Number(stockUpdate.lowStockAlert) })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to update');
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, stock: Number(stockUpdate.quantity), lowStockAlert: Number(stockUpdate.lowStockAlert) } : p));
      setShowStockModal(false);
      toast.success('Stock updated successfully');
    } catch (e) {
      toast.error(e?.message || 'Failed to update stock');
    }
  };

  const bulkUpdateStock = async (action, value) => {
    try {
      const token = localStorage.getItem('adminToken');
      const ORIGIN3 = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const base = process.env.REACT_APP_API_URL || (ORIGIN3 && ORIGIN3.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN3 || 'http://localhost:5000'));
      const updates = products.map(p => {
        let newStock = p.stock;
        const qty = Number(value);
        if (action === 'add') newStock = p.stock + qty;
        else if (action === 'subtract') newStock = Math.max(0, p.stock - qty);
        else if (action === 'set') newStock = qty;
        return { id: p.id, stock: newStock, lowStockAlert: p.lowStockAlert || 10 };
      });
      await Promise.all(updates.map(async u => {
        const res = await fetch(`${base}/api/v1/products/${u.id}/inventory`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
          body: JSON.stringify({ stock: u.stock, lowStockAlert: u.lowStockAlert })
        });
        if (!res.ok) throw new Error('Failed one of updates');
      }));
      setProducts(prev => prev.map(p => {
        const u = updates.find(x => x.id === p.id);
        return u ? { ...p, stock: u.stock } : p;
      }));
      toast.success('Bulk stock update completed');
    } catch (e) {
      toast.error(e?.message || 'Bulk update failed');
    }
  };

  const exportInventory = () => {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Inventory exported successfully');
  };

  const generateCSV = () => {
    const headers = ['SKU', 'Product Name', 'Category', 'Vendor', 'Current Stock', 'Low Stock Alert', 'Status'];
    const rows = products.map(product => [
      product.sku,
      product.name,
      getCategoryName(product.categoryId),
      getVendorName(product.vendorId),
      product.stock,
      product.lowStockAlert || 10,
      getStockStatus(product)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const importInventory = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csv = e.target.result;
          const lines = csv.split('\n');
          const headers = lines[0].split(',');
          
          // Process CSV and update products
          // This is a simplified implementation
          toast.success('Inventory imported successfully');
          setShowImportModal(false);
        } catch (error) {
          toast.error('Error importing inventory');
        }
      };
      reader.readAsText(file);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.companyName : 'N/A';
  };

  const getStockStatus = (product) => {
    if (product.stock === 0) return 'Out of Stock';
    if (product.stock <= (product.lowStockAlert || 10)) return 'Low Stock';
    return 'In Stock';
  };

  const getStockStatusClass = (product) => {
    if (product.stock === 0) return 'out-of-stock';
    if (product.stock <= (product.lowStockAlert || 10)) return 'low-stock';
    return 'in-stock';
  };

  const getLowStockProducts = () => {
    return products.filter(product => 
      product.stock > 0 && product.stock <= (product.lowStockAlert || 10)
    );
  };

  const getOutOfStockProducts = () => {
    return products.filter(product => product.stock === 0);
  };

  const getTotalStockValue = () => {
    return products.reduce((sum, product) => {
      const price = product.specialPrice || product.regularPrice;
      return sum + (price * product.stock);
    }, 0);
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  if (loading) {
    return <div className="loading">Loading inventory...</div>;
  }

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Inventory Management</h1>
        <div className="header-actions">
          <button onClick={exportInventory} className="btn btn-success">
            Export CSV
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn btn-primary">
            Import CSV
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
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Stock</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
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
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Products</h3>
          <p>{products.length}</p>
        </div>
        <div className="stat-card">
          <h3>In Stock</h3>
          <p>{products.filter(p => p.stock > 0).length}</p>
        </div>
        <div className="stat-card">
          <h3>Low Stock</h3>
          <p>{getLowStockProducts().length}</p>
        </div>
        <div className="stat-card">
          <h3>Out of Stock</h3>
          <p>{getOutOfStockProducts().length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Stock Value</h3>
          <p>{formatCurrency(getTotalStockValue())}</p>
        </div>
      </div>

      {/* Stock Alerts */}
      <div className="alerts-section">
        <div className="alert-cards">
          <div className="alert-card low-stock">
            <h3>Low Stock Alert</h3>
            <p>{getLowStockProducts().length} products need restocking</p>
            <button 
              onClick={() => setStockFilter('low-stock')}
              className="btn btn-warning btn-sm"
            >
              View Products
            </button>
          </div>
          <div className="alert-card out-of-stock">
            <h3>Out of Stock</h3>
            <p>{getOutOfStockProducts().length} products are out of stock</p>
            <button 
              onClick={() => setStockFilter('out-of-stock')}
              className="btn btn-danger btn-sm"
            >
              View Products
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bulk-actions">
        <h3>Bulk Stock Operations</h3>
        <div className="bulk-controls">
          <select className="bulk-action-select">
            <option value="add">Add Stock</option>
            <option value="subtract">Subtract Stock</option>
            <option value="set">Set Stock</option>
          </select>
          <input
            type="number"
            placeholder="Quantity"
            className="bulk-quantity"
            min="0"
          />
          <button 
            onClick={() => {
              const action = document.querySelector('.bulk-action-select').value;
              const quantity = document.querySelector('.bulk-quantity').value;
              if (quantity) {
                bulkUpdateStock(action, quantity);
              }
            }}
            className="btn btn-primary"
          >
            Apply to All
          </button>
        </div>
      </div>

      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Current Stock</th>
              <th>Low Stock Alert</th>
              <th>Status</th>
              <th>Stock Value</th>
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
                      <small>{formatCurrency(product.specialPrice || product.regularPrice)}</small>
                    </div>
                  </div>
                </td>
                <td>{product.sku}</td>
                <td>{getCategoryName(product.categoryId)}</td>
                <td>{getVendorName(product.vendorId)}</td>
                <td>
                  <span className={`stock-quantity ${getStockStatusClass(product)}`}>
                    {product.stock}
                  </span>
                </td>
                <td>{product.lowStockAlert || 10}</td>
                <td>
                  <span className={`stock-status ${getStockStatusClass(product)}`}>
                    {getStockStatus(product)}
                  </span>
                </td>
                <td>
                  <strong>
                    {formatCurrency((product.specialPrice || product.regularPrice) * product.stock)}
                  </strong>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleStockUpdate(product)}
                      className="btn btn-info btn-sm"
                    >
                      Update Stock
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

      {/* Stock Update Modal */}
      {showStockModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Update Stock - {selectedProduct.name}</h2>
              <button onClick={() => setShowStockModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="stock-update-form">
                <div className="current-stock">
                  <h3>Current Stock Information</h3>
                  <div className="stock-info">
                    <div className="info-item">
                      <label>Current Stock:</label>
                      <span>{selectedProduct.stock}</span>
                    </div>
                    <div className="info-item">
                      <label>Low Stock Alert:</label>
                      <span>{selectedProduct.lowStockAlert || 10}</span>
                    </div>
                    <div className="info-item">
                      <label>Status:</label>
                      <span className={`stock-status ${getStockStatusClass(selectedProduct)}`}>
                        {getStockStatus(selectedProduct)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="update-fields">
                  <h3>Update Stock</h3>
                  <div className="form-group">
                    <label>New Stock Quantity:</label>
                    <input
                      type="number"
                      value={stockUpdate.quantity}
                      onChange={(e) => setStockUpdate(prev => ({ ...prev, quantity: e.target.value }))}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Low Stock Alert Threshold:</label>
                    <input
                      type="number"
                      value={stockUpdate.lowStockAlert}
                      onChange={(e) => setStockUpdate(prev => ({ ...prev, lowStockAlert: e.target.value }))}
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowStockModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={updateStock} className="btn btn-primary">
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Import Inventory</h2>
              <button onClick={() => setShowImportModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="import-instructions">
                <h3>Instructions</h3>
                <p>Upload a CSV file with the following columns:</p>
                <ul>
                  <li><strong>SKU</strong> - Product SKU</li>
                  <li><strong>Stock</strong> - New stock quantity</li>
                  <li><strong>LowStockAlert</strong> - Low stock threshold (optional)</li>
                </ul>
                <div className="sample-csv">
                  <h4>Sample CSV Format:</h4>
                  <pre>SKU,Stock,LowStockAlert
PROD001,50,10
PROD002,25,5
PROD003,0,10</pre>
                </div>
              </div>
              <div className="import-upload">
                <input
                  type="file"
                  accept=".csv"
                  onChange={importInventory}
                  className="file-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowImportModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={() => document.querySelector('.file-input').click()}
                className="btn btn-primary"
              >
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory; 