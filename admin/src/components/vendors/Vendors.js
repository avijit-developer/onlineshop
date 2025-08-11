import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Vendors.css';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchTerm, statusFilter]);

  const fetchVendors = async () => {
    try {
      const response = await fetch('/data.json');
      const data = await response.json();
      setVendors(data.vendors || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
      setLoading(false);
    }
  };

  const filterVendors = () => {
    let filtered = vendors;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(vendor =>
        vendor.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.phone.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(vendor => vendor.status === statusFilter);
    }

    setFilteredVendors(filtered);
    setCurrentPage(1);
  };

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      // Simulate API call
      const updatedVendors = vendors.map(vendor =>
        vendor.id === vendorId ? { ...vendor, status: newStatus } : vendor
      );
      setVendors(updatedVendors);
      
      toast.success(`Vendor ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toast.error('Failed to update vendor status');
    }
  };

  const handleEnableDisable = async (vendorId, enabled) => {
    try {
      const updatedVendors = vendors.map(vendor =>
        vendor.id === vendorId ? { ...vendor, enabled } : vendor
      );
      setVendors(updatedVendors);
      
      toast.success(`Vendor ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      toast.error('Failed to update vendor status');
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
    // Load chat messages for this vendor
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

  const updateCommission = () => {
    if (selectedVendor) {
      const updatedVendors = vendors.map(vendor =>
        vendor.id === selectedVendor.id 
          ? { ...vendor, commission: commissionSettings.vendorSpecific[selectedVendor.id] || commissionSettings.globalCommission }
          : vendor
      );
      setVendors(updatedVendors);
      setShowCommissionModal(false);
      toast.success('Commission updated successfully');
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVendors = filteredVendors.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);

  if (loading) {
    return <div className="loading">Loading vendors...</div>;
  }

  return (
    <div className="vendors-container">
      <div className="page-header">
        <h1>Vendor Management</h1>
        <div className="header-actions">
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search vendors..."
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
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Vendors</h3>
          <p>{vendors.length}</p>
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
            {currentVendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>
                  <div className="vendor-info">
                    <img src={vendor.logo || '/default-vendor.png'} alt={vendor.companyName} className="vendor-logo" />
                    <div>
                      <strong>{vendor.name}</strong>
                      <small>ID: {vendor.id}</small>
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
                          onClick={() => handleStatusChange(vendor.id, 'approved')}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(vendor.id, 'rejected')}
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
                      onClick={() => handleEnableDisable(vendor.id, !vendor.enabled)}
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

      {/* Vendor Profile Modal */}
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
                  <div className="detail-group">
                    <label>Email:</label>
                    <span>{selectedVendor.email}</span>
                  </div>
                  <div className="detail-group">
                    <label>Phone:</label>
                    <span>{selectedVendor.phone}</span>
                  </div>
                  <div className="detail-group">
                    <label>Address:</label>
                    <span>{selectedVendor.address}</span>
                  </div>
                  <div className="detail-group">
                    <label>Status:</label>
                    <span className={`status-badge ${selectedVendor.status}`}>
                      {selectedVendor.status}
                    </span>
                  </div>
                  <div className="detail-group">
                    <label>Balance:</label>
                    <span>${selectedVendor.balance?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="detail-group">
                    <label>Total Earnings:</label>
                    <span>${selectedVendor.totalEarnings?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="detail-group">
                    <label>Commission:</label>
                    <span>{selectedVendor.commission || commissionSettings.globalCommission}%</span>
                  </div>
                </div>

                <div className="vendor-stats">
                  <div className="stat-item">
                    <h4>Products</h4>
                    <p>{selectedVendor.productsCount || 0}</p>
                  </div>
                  <div className="stat-item">
                    <h4>Orders</h4>
                    <p>{selectedVendor.ordersCount || 0}</p>
                  </div>
                  <div className="stat-item">
                    <h4>Rating</h4>
                    <p>{selectedVendor.rating || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commission Settings Modal */}
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
                    value={commissionSettings.vendorSpecific[selectedVendor.id] || commissionSettings.globalCommission}
                    onChange={(e) => setCommissionSettings({
                      ...commissionSettings,
                      vendorSpecific: {
                        ...commissionSettings.vendorSpecific,
                        [selectedVendor.id]: parseFloat(e.target.value)
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
              <button onClick={() => setShowCommissionModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={updateCommission} className="btn btn-primary">
                Update Commission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
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
                    <div className="message-content">
                      {message.message}
                    </div>
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
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
                <button onClick={sendMessage} className="btn btn-primary">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors; 