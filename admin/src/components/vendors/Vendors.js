import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Vendors.css';
import defaultVendor from '../../assets/default-vendor.png';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Get current user and permissions
  const getCurrentUser = () => {
    const userData = localStorage.getItem('adminUser');
    return userData ? JSON.parse(userData) : null;
  };

  const currentUser = getCurrentUser();
  const userPerms = new Set(currentUser?.permissions || []);
  const isVendor = currentUser?.role === 'vendor';
  const isAdmin = currentUser?.role === 'admin';
  const has = (perm) => isAdmin || userPerms.has('*') || userPerms.has(perm);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    zip: '',
    // commission field removed per new logic; keep placeholder for backend compatibility if needed
    commission: undefined,
    logoPreview: ''
  });
  const [imageFile, setImageFile] = useState(null);

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

  const formatAddress = (v) => {
    if (!v) return '';
    const parts = [v.address1, v.address2, v.city, v.zip]
      .map((s) => (s || '').trim())
      .filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    fetchVendors();
  }, [currentPage, itemsPerPage, searchTerm, statusFilter]);

  // Function to refresh user permissions
  const refreshUserPermissions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE}/api/v1/auth/current-permissions`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('🔄 VENDORS: Refreshed permissions:', data.permissions);
        
        // Update localStorage with new permissions
        const currentUser = getCurrentUser();
        const updatedUser = { ...currentUser, permissions: data.permissions };
        localStorage.setItem('adminUser', JSON.stringify(updatedUser));
        
        // Reload the page to apply new permissions
        window.location.reload();
        
        toast.success('Permissions refreshed!');
      } else {
        toast.error('Failed to refresh permissions');
      }
    } catch (error) {
      console.error('Error refreshing permissions:', error);
      toast.error('Failed to refresh permissions');
    }
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const q = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';
      const status = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : '';
      
      console.log('Fetching vendors with user:', currentUser);
      console.log('User permissions:', userPerms);
      
      const res = await fetch(`${API_BASE}/api/v1/vendors?page=${currentPage}&limit=${itemsPerPage}${status}${q}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      
      console.log('Vendors API response:', { status: res.status, ok: res.ok, data: json });
      
      if (!res.ok) throw new Error(json?.message || 'Failed to load vendors');
      setVendors(json.data || []);
      setTotal(json?.meta?.total || 0);
      const pagesCount = Math.max(1, Math.ceil((json?.meta?.total || 0) / itemsPerPage));
      if (currentPage > pagesCount) setCurrentPage(pagesCount);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error(error.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update status');
      toast.success(`Vendor ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor status');
    }
  };

  const handleEnableToggle = async (vendor, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendor._id || vendor.id}/enable`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update enable status');
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor status');
    }
  };

  const viewProfile = (vendor) => {
    setSelectedVendor(vendor);
    setShowProfileModal(true);
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

  const uploadToCloudinary = async (file, subfolder = 'vendors') => {
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

  const handleOpenAdd = () => {
    setFormData({ name: '', companyName: '', email: '', phone: '', address1: '', address2: '', city: '', zip: '', commission: undefined, logoPreview: '' });
    setImageFile(null);
    setShowAddModal(true);
  };

  const handleAddInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setFormData(prev => ({ ...prev, logoPreview: URL.createObjectURL(file) }));
    }
  };

  const submitAddVendor = async (e) => {
    e.preventDefault();
    try {
      if (addSubmitting) return;
      setAddSubmitting(true);
      if (!formData.name.trim() || !formData.companyName.trim() || !formData.email.trim()) {
        toast.error('Name, Company and Email are required');
        setAddSubmitting(false);
        return;
      }
      let payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address1: formData.address1.trim(),
        address2: formData.address2.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
        // commission removed; do not send unless explicitly set
      };
      if (imageFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(imageFile, 'vendors');
        payload.imageUrl = imageUrl;
        payload.imagePublicId = imagePublicId;
      }
      const res = await fetch(`${API_BASE}/api/v1/vendors`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to add vendor');
      toast.success('Vendor added successfully');
      setShowAddModal(false);
      setImageFile(null);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to add vendor');
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name || '',
      companyName: vendor.companyName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address1: vendor.address1 || '',
      address2: vendor.address2 || '',
      city: vendor.city || '',
      zip: vendor.zip || '',
      commission: undefined,
      logoPreview: vendor.logo || ''
    });
    setImageFile(null);
    setShowEditModal(true);
  };

  const submitEditVendor = async (e) => {
    e.preventDefault();
    try {
      if (editSubmitting) return;
      setEditSubmitting(true);
      const vendorId = selectedVendor?._id || selectedVendor?.id;
      if (!vendorId) throw new Error('No vendor selected');
      if (!formData.name.trim() || !formData.companyName.trim() || !formData.email.trim()) {
        toast.error('Name, Company and Email are required');
        setEditSubmitting(false);
        return;
      }
      let payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address1: formData.address1.trim(),
        address2: formData.address2.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
        // commission removed; do not send unless explicitly set
      };
      if (imageFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(imageFile, 'vendors');
        payload.imageUrl = imageUrl;
        payload.imagePublicId = imagePublicId;
      }
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendorId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update vendor');
      toast.success('Vendor updated successfully');
      setShowEditModal(false);
      setImageFile(null);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendor._id || vendor.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete vendor');
      toast.success('Vendor deleted');
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to delete vendor');
    }
  };

  const pagesCount = Math.max(1, Math.ceil(total / itemsPerPage));

  if (loading) {
    return <div className="loading">Loading vendors...</div>;
  }

  return (
    <div className="vendors-container">
      <div className="page-header">
        <h1>Vendor Management</h1>
        <div className="header-actions">
          <div className="view-toggle">
            {has('vendor.add') && (
              <button className="btn btn-primary" onClick={handleOpenAdd}>Add Vendor</button>
            )}
            {isVendor && (
              <button className="btn btn-secondary" onClick={refreshUserPermissions} title="Refresh permissions">
                🔄 Refresh Permissions
              </button>
            )}
          </div>
          <div className="search-filter-container">
            <div className="search-group">
              <input
                type="text"
                placeholder="Search vendors..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearchTerm(pendingSearch.trim()); setCurrentPage(1); } }}
                className="search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="btn btn-primary" onClick={() => { setSearchTerm(pendingSearch.trim()); setCurrentPage(1); }}>Search</button>
              {searchTerm && (
                <button className="btn btn-secondary" onClick={() => { setPendingSearch(''); setSearchTerm(''); setCurrentPage(1); }}>Clear</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Vendors</h3>
          <p>{total}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Approval</h3>
          <p>{vendors.filter(v => v.status === 'pending').length}</p>
        </div>
        <div className="stat-card">
          <h3>Active Vendors</h3>
          <p>{vendors.filter(v => v.status === 'approved' && v.enabled).length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>${vendors.reduce((sum, v) => sum + (v.totalEarnings || 0), 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="vendors-table-container">
        <table className="vendors-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Enabled</th>
              {/* Commission removed */}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor._id || vendor.id}>
                <td>
                  <div className="vendor-info">
                    <img src={vendor.logo && vendor.logo.trim() ? vendor.logo : defaultVendor} alt={vendor.companyName} className="vendor-logo" />
                    <div>
                      <strong>{vendor.name}</strong>
                      <small>{vendor._id || vendor.id}</small>
                    </div>
                  </div>
                </td>
                <td>{vendor.companyName}</td>
                <td>{vendor.email}</td>
                <td>{vendor.phone}</td>
                <td>
                  <span className={`status-badge ${vendor.status}`}>
                    {vendor.status}
                  </span>
                </td>
                <td>
                  {has('vendor.edit') ? (
                    <label className="toggle-switch">
                      <input type="checkbox" checked={!!vendor.enabled} onChange={(e) => handleEnableToggle(vendor, e.target.checked)} />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span>{vendor.enabled ? 'Yes' : 'No'}</span>
                  )}
                </td>
                {/* Commission removed from view */}
                <td>
                  <div className="action-buttons">
                    <button title="View" onClick={() => viewProfile(vendor)} className="btn btn-secondary btn-sm">👁️</button>
                    {vendor.status === 'pending' && !isVendor && has('vendor.approve') && (
                      <>
                        <button title="Approve" onClick={() => handleStatusChange(vendor._id || vendor.id, 'approved')} className="btn btn-success btn-sm">✔️</button>
                        <button title="Reject" onClick={() => handleStatusChange(vendor._id || vendor.id, 'rejected')} className="btn btn-danger btn-sm">✖️</button>
                      </>
                    )}
                    {has('vendor.edit') && (
                      <button title="Edit" onClick={() => openEdit(vendor)} className="btn btn-info btn-sm">✏️</button>
                    )}
                    {has('vendor.delete') && (
                      <button title="Delete" onClick={() => handleDeleteVendor(vendor)} className="btn btn-danger btn-sm">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="btn btn-secondary">First</button>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-secondary">Prev</button>
        <span className="page-info">Page {currentPage} of {Math.max(1, Math.ceil(total / itemsPerPage))}</span>
        <button onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(total / itemsPerPage)), p + 1))} disabled={currentPage >= Math.max(1, Math.ceil(total / itemsPerPage))} className="btn btn-secondary">Next</button>
        <button onClick={() => setCurrentPage(Math.max(1, Math.ceil(total / itemsPerPage)))} disabled={currentPage >= Math.max(1, Math.ceil(total / itemsPerPage))} className="btn btn-secondary">Last</button>
        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="page-size-select" style={{ marginLeft: 8 }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Add Vendor</h2>
              <button onClick={() => setShowAddModal(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={submitAddVendor} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 1 *</label>
                  <input type="text" name="address1" value={formData.address1} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 2</label>
                  <input type="text" name="address2" value={formData.address2} onChange={handleAddInput} />
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>ZIP *</label>
                  <input type="text" name="zip" value={formData.zip} onChange={handleAddInput} required />
                </div>
                {/* Commission removed */}
                <div className="form-group full-width">
                  <label>Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoChange} />
                  {formData.logoPreview && (
                    <div className="image-preview">
                      <img src={(formData.logoPreview && formData.logoPreview.trim()) ? formData.logoPreview : defaultVendor} alt="Logo preview" />
                    </div>
                  )}
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={submitAddVendor} className="btn btn-primary" disabled={addSubmitting}>{addSubmitting ? 'Saving...' : 'Add Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Edit Vendor</h2>
              <button onClick={() => setShowEditModal(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={submitEditVendor} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 1 *</label>
                  <input type="text" name="address1" value={formData.address1} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 2</label>
                  <input type="text" name="address2" value={formData.address2} onChange={handleAddInput} />
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>ZIP *</label>
                  <input type="text" name="zip" value={formData.zip} onChange={handleAddInput} required />
                </div>
                {/* Commission removed */}
                <div className="form-group full-width">
                  <label>Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoChange} />
                  {formData.logoPreview && (
                    <div className="image-preview">
                      <img src={(formData.logoPreview && formData.logoPreview.trim()) ? formData.logoPreview : defaultVendor} alt="Logo preview" />
                    </div>
                  )}
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={submitEditVendor} className="btn btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Update Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal profile-modal">
            <div className="modal-header">
              <h2>Vendor Profile</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {selectedVendor?.status === 'pending' && !isVendor && has('vendor.approve') && (
                  <button onClick={() => handleStatusChange(selectedVendor._id || selectedVendor.id, 'approved')} className="btn btn-success btn-sm">Approve</button>
                )}
                <button onClick={() => setShowProfileModal(false)} className="close-btn">&times;</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="vendor-profile">
                <div className="profile-header">
                  <img src={selectedVendor.logo && selectedVendor.logo.trim() ? selectedVendor.logo : defaultVendor} alt={selectedVendor.companyName} />
                  <div>
                    <h3>{selectedVendor.companyName}</h3>
                    <p>{selectedVendor.name}</p>
                  </div>
                </div>
                <div className="profile-details">
                  <div className="detail-group"><label>Email:</label><span>{selectedVendor.email}</span></div>
                  <div className="detail-group"><label>Phone:</label><span>{selectedVendor.phone}</span></div>
                  <div className="detail-group"><label>Address:</label><span>{formatAddress(selectedVendor) || '—'}</span></div>
                  <div className="detail-group"><label>Status:</label><span className={`status-badge ${selectedVendor.status}`}>{selectedVendor.status}</span></div>
                  <div className="detail-group"><label>Balance:</label><span>${selectedVendor.balance?.toLocaleString() || '0'}</span></div>
                  <div className="detail-group"><label>Total Earnings:</label><span>${selectedVendor.totalEarnings?.toLocaleString() || '0'}</span></div>
                  {/* Commission removed from view */}
                </div>
                <div className="vendor-stats">
                  <div className="stat-item"><h4>Products</h4><p>{selectedVendor.productsCount || 0}</p></div>
                  <div className="stat-item"><h4>Orders</h4><p>{selectedVendor.ordersCount || 0}</p></div>
                  <div className="stat-item"><h4>Rating</h4><p>{selectedVendor.rating || 'N/A'}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;