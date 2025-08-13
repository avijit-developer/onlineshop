import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Vendors.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [commissionSettings, setCommissionSettings] = useState({
    globalCommission: 10,
    vendorSpecific: {}
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    commission: 10,
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

  useEffect(() => {
    fetchVendors();
  }, [currentPage, itemsPerPage, searchTerm, statusFilter]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const q = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';
      const status = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : '';
      const res = await fetch(`${API_BASE}/api/v1/vendors?page=${currentPage}&limit=${itemsPerPage}${status}${q}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
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

  const handleEnableDisable = async (vendorId, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendorId}/enable`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update enable status');
      toast.success(`Vendor ${enabled ? 'enabled' : 'disabled'} successfully`);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor status');
    }
  };

  const viewProfile = (vendor) => {
    setSelectedVendor(vendor);
    setShowProfileModal(true);
  };

  const openCommissionModal = (vendor) => {
    setSelectedVendor(vendor);
    setShowCommissionModal(true);
  };

  const openChatModal = (vendor) => {
    setSelectedVendor(vendor);
    setShowChatModal(true);
    setChatMessages([
      { id: 1, sender: 'admin', message: 'Hello! How can I help you?', timestamp: new Date().toISOString() },
      { id: 2, sender: 'vendor', message: 'I have a question about my commission.', timestamp: new Date().toISOString() }
    ]);
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: chatMessages.length + 1,
        sender: 'admin',
        message: newMessage,
        timestamp: new Date().toISOString()
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');
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
    setFormData({ name: '', companyName: '', email: '', phone: '', address: '', commission: 10, logoPreview: '' });
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
        address: formData.address.trim(),
        commission: Number(formData.commission) || 0
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
            <button className="btn btn-primary" onClick={handleOpenAdd}>Add Vendor</button>
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
              <th>Balance</th>
              <th>Commission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor._id || vendor.id}>
                <td>
                  <div className="vendor-info">
                    <img src={vendor.logo || '/default-vendor.png'} alt={vendor.companyName} className="vendor-logo" />
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
                <td>${vendor.balance?.toLocaleString() || '0'}</td>
                <td>{vendor.commission || commissionSettings.globalCommission}%</td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => viewProfile(vendor)}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </button>
                    {vendor.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(vendor._id || vendor.id, 'approved')}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(vendor._id || vendor.id, 'rejected')}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openCommissionModal(vendor)}
                      className="btn btn-info btn-sm"
                    >
                      Commission
                    </button>
                    <button
                      onClick={() => openChatModal(vendor)}
                      className="btn btn-primary btn-sm"
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => handleEnableDisable(vendor._id || vendor.id, !vendor.enabled)}
                      className={`btn btn-sm ${vendor.enabled ? 'btn-warning' : 'btn-success'}`}
                    >
                      {vendor.enabled ? 'Disable' : 'Enable'}
                    </button>
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
        <span className="page-info">Page {currentPage} of {pagesCount}</span>
        <button onClick={() => setCurrentPage(p => Math.min(pagesCount, p + 1))} disabled={currentPage >= pagesCount} className="btn btn-secondary">Next</button>
        <button onClick={() => setCurrentPage(pagesCount)} disabled={currentPage >= pagesCount} className="btn btn-secondary">Last</button>
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
                  <label>Phone</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleAddInput} />
                </div>
                <div className="form-group full-width">
                  <label>Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleAddInput} />
                </div>
                <div className="form-group">
                  <label>Commission (%)</label>
                  <input type="number" name="commission" min="0" max="100" step="0.1" value={formData.commission} onChange={handleAddInput} />
                </div>
                <div className="form-group full-width">
                  <label>Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoChange} />
                  {formData.logoPreview && (
                    <div className="image-preview">
                      <img src={formData.logoPreview} alt="Logo preview" />
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

      {/* Existing Modals: Profile, Commission, Chat */}
      {showProfileModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Vendor Profile</h2>
              <button onClick={() => setShowProfileModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="vendor-profile">
                <div className="profile-header">
                  <img src={selectedVendor.logo || '/default-vendor.png'} alt={selectedVendor.companyName} />
                  <div>
                    <h3>{selectedVendor.companyName}</h3>
                    <p>{selectedVendor.name}</p>
                  </div>
                </div>
                <div className="profile-details">
                  <div className="detail-group"><label>Email:</label><span>{selectedVendor.email}</span></div>
                  <div className="detail-group"><label>Phone:</label><span>{selectedVendor.phone}</span></div>
                  <div className="detail-group"><label>Address:</label><span>{selectedVendor.address}</span></div>
                  <div className="detail-group"><label>Status:</label><span className={`status-badge ${selectedVendor.status}`}>{selectedVendor.status}</span></div>
                  <div className="detail-group"><label>Balance:</label><span>${selectedVendor.balance?.toLocaleString() || '0'}</span></div>
                  <div className="detail-group"><label>Total Earnings:</label><span>${selectedVendor.totalEarnings?.toLocaleString() || '0'}</span></div>
                  <div className="detail-group"><label>Commission:</label><span>{selectedVendor.commission || commissionSettings.globalCommission}%</span></div>
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

      {showCommissionModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Commission Settings</h2>
              <button onClick={() => setShowCommissionModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="commission-settings">
                <div className="setting-group">
                  <label>Global Commission Rate:</label>
                  <input
                    type="number"
                    value={commissionSettings.globalCommission}
                    onChange={(e) => setCommissionSettings({
                      ...commissionSettings,
                      globalCommission: parseFloat(e.target.value)
                    })}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span>%</span>
                </div>
                <div className="setting-group">
                  <label>Vendor Specific Commission:</label>
                  <input
                    type="number"
                    value={commissionSettings.vendorSpecific[selectedVendor._id || selectedVendor.id] || commissionSettings.globalCommission}
                    onChange={(e) => setCommissionSettings({
                      ...commissionSettings,
                      vendorSpecific: {
                        ...commissionSettings.vendorSpecific,
                        [selectedVendor._id || selectedVendor.id]: parseFloat(e.target.value)
                      }
                    })}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span>%</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCommissionModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => setShowCommissionModal(false)} className="btn btn-primary">Update Commission</button>
            </div>
          </div>
        </div>
      )}

      {showChatModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal chat-modal">
            <div className="modal-header">
              <h2>Chat with {selectedVendor.companyName}</h2>
              <button onClick={() => setShowChatModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="chat-messages">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`message ${message.sender}`}>
                    <div className="message-content">{message.message}</div>
                    <div className="message-time">{new Date(message.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
              <div className="chat-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="btn btn-primary">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors; 