import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/currency';
import { formatDate, formatDateTime } from '../../utils/date';
import { toast } from 'react-hot-toast';
import './Payments.css';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [vendorSummary, setVendorSummary] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('earnings');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const round2 = (n) => {
    const x = Number(n || 0);
    return Math.round((x + Number.EPSILON) * 100) / 100;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortBy, sortOrder, activeTab]);

  const fetchData = async () => {
    try {
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const [earnRes, venRes, sumRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/payments/admin-earnings?status=completed`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${baseUrl}/api/v1/vendors?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => ({ ok: true, json: async () => ({ data: [] }) })),
        fetch(`${baseUrl}/api/v1/payments/vendor-summary?status=completed`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      ]);
      if (venRes && venRes.ok) {
        const vjson = await venRes.json();
        setVendors((vjson.data || []).map(v => ({ id: v._id || v.id, companyName: v.companyName, email: v.email, logo: v.logo })));
      }
      if (!earnRes.ok) throw new Error('Failed to load earnings');
      const ej = await earnRes.json();
      const rows = (ej?.data || []).map((r, idx) => ({
        id: r.id || idx,
        orderId: r.orderId,
        customerName: r.customerName || '',
        amount: Number(r.amount || 0),
        commission: Number(r.commission || 0),
        vendorEarnings: Number(r.vendorEarnings || 0),
        paymentMethod: r.paymentMethod || '',
        status: r.status || 'pending',
        date: r.date,
        vendorId: r.vendorId,
      }));
      setPayments(rows);
      if (sumRes && sumRes.ok) {
        const sj = await sumRes.json();
        setVendorSummary(sj?.data || []);
      }
      // Keep withdrawals as manual flow for now
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const generateSamplePayments = () => {
    return [
      {
        id: 1,
        orderId: 'ORD001',
        customerName: 'John Doe',
        amount: 299.99,
        commission: 29.99,
        vendorEarnings: 270.00,
        paymentMethod: 'Credit Card',
        status: 'completed',
        date: '2024-01-15T10:30:00Z',
        vendorId: 1
      },
      {
        id: 2,
        orderId: 'ORD002',
        customerName: 'Jane Smith',
        amount: 149.50,
        commission: 14.95,
        vendorEarnings: 134.55,
        paymentMethod: 'PayPal',
        status: 'completed',
        date: '2024-01-14T15:45:00Z',
        vendorId: 2
      },
      {
        id: 3,
        orderId: 'ORD003',
        customerName: 'Mike Johnson',
        amount: 89.99,
        commission: 8.99,
        vendorEarnings: 81.00,
        paymentMethod: 'Credit Card',
        status: 'pending',
        date: '2024-01-13T09:20:00Z',
        vendorId: 1
      }
    ];
  };

  const generateSampleWithdrawals = () => {
    return [
      {
        id: 1,
        vendorId: 1,
        vendorName: 'TechStore Pro',
        amount: 500.00,
        status: 'pending',
        requestDate: '2024-01-15T14:30:00Z',
        paymentMethod: 'Bank Transfer',
        accountDetails: '****1234'
      },
      {
        id: 2,
        vendorId: 2,
        vendorName: 'Fashion Hub',
        amount: 750.00,
        status: 'approved',
        requestDate: '2024-01-14T11:20:00Z',
        processedDate: '2024-01-15T10:00:00Z',
        paymentMethod: 'PayPal',
        accountDetails: 'vendor@fashionhub.com'
      },
      {
        id: 3,
        vendorId: 3,
        vendorName: 'Home Essentials',
        amount: 300.00,
        status: 'rejected',
        requestDate: '2024-01-13T16:45:00Z',
        rejectionReason: 'Insufficient balance',
        paymentMethod: 'Bank Transfer',
        accountDetails: '****5678'
      }
    ];
  };

  const handleWithdrawalAction = (withdrawalId, action) => {
    const updatedWithdrawals = withdrawals.map(withdrawal => {
      if (withdrawal.id === withdrawalId) {
        return {
          ...withdrawal,
          status: action,
          processedDate: action === 'approved' ? new Date().toISOString() : undefined,
          rejectionReason: action === 'rejected' ? 'Admin decision' : undefined
        };
      }
      return withdrawal;
    });
    setWithdrawals(updatedWithdrawals);
    setShowWithdrawalModal(false);
    toast.success(`Withdrawal ${action} successfully`);
  };

  const handleManualPayout = () => {
    (async () => {
      if (selectedVendor && payoutAmount) {
        try {
          const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
          const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
          const token = localStorage.getItem('adminToken');
          const resp = await fetch(`${baseUrl}/api/v1/payments/payouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ vendorId: selectedVendor.id, amount: Number(payoutAmount), method: 'Manual', note: 'Admin manual payout' })
          });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok || !json?.success) throw new Error(json?.message || 'Failed to record payout');
          const newWithdrawal = {
            id: json?.data?.id || Date.now(),
            vendorId: selectedVendor.id,
            vendorName: selectedVendor.companyName,
            amount: parseFloat(payoutAmount),
            status: 'approved',
            requestDate: new Date().toISOString(),
            processedDate: new Date().toISOString(),
            paymentMethod: 'Manual Payout',
            accountDetails: 'Admin initiated'
          };
          setWithdrawals([newWithdrawal, ...withdrawals]);
          // Refresh vendor summary to recalc due
          await fetchData();
          setShowPayoutModal(false);
          setPayoutAmount('');
          toast.success('Manual payout processed successfully');
        } catch (e) {
          toast.error(e?.message || 'Failed to process payout');
        }
      }
    })();
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.companyName : 'Unknown Vendor';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'status-success';
      case 'pending':
        return 'status-pending';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  };

  const getTotalEarnings = () => {
    return payments.reduce((sum, payment) => sum + payment.commission, 0);
  };

  const getTotalVendorPayouts = () => {
    return withdrawals
      .filter(w => w.status === 'approved')
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  };

  const getPendingWithdrawals = () => {
    return withdrawals.filter(w => w.status === 'pending');
  };

  const getVendorBalance = (vendorId) => {
    const vs = vendorSummary.find(v => String(v.vendorId) === String(vendorId));
    const due = vs ? Number(vs.due || (vs.vendorEarnings - (vs.paid || 0))) : 0;
    const vendorWithdrawals = withdrawals.filter(w => String(w.vendorId) === String(vendorId) && w.status === 'approved');
    const manualPaid = vendorWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    return round2(Math.max(0, due - manualPaid));
  };

  // Filter and sort functions
  const getFilteredPayments = () => {
    let filtered = payments;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(payment => 
        payment.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getVendorName(payment.vendorId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(payment => payment.status === filterStatus);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'commission':
          aValue = a.commission;
          bValue = b.commission;
          break;
        case 'date':
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  };

  const getFilteredWithdrawals = () => {
    let filtered = withdrawals;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(withdrawal => 
        withdrawal.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(withdrawal => withdrawal.status === filterStatus);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'date':
        default:
          aValue = new Date(a.requestDate);
          bValue = new Date(b.requestDate);
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  };

  // Pagination
  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(
    activeTab === 'earnings' 
      ? getFilteredPayments().length / itemsPerPage
      : getFilteredWithdrawals().length / itemsPerPage
  );

  if (loading) {
    return <div className="loading">Loading payments...</div>;
  }

  return (
    <div className="payments-container">
      <div className="page-header">
        <h1>Payments & Transactions</h1>
        <div className="header-actions" />
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Admin Earnings</h3>
          <p>{formatCurrency(getTotalEarnings())}</p>
        </div>
        <div className="stat-card">
          <h3>Total Vendor Payouts</h3>
          <p>{formatCurrency(getTotalVendorPayouts())}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Withdrawals</h3>
          <p>{getPendingWithdrawals().length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Transactions</h3>
          <p>{payments.length}</p>
        </div>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            Admin Earnings
          </button>
          <button
            className={`tab ${activeTab === 'payouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('payouts')}
          >
            Vendor Payouts
          </button>
          <button
            className={`tab ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            Withdrawal Requests
          </button>
        </div>

        <div className="tab-content">
          {/* Admin Earnings Tab */}
          {activeTab === 'earnings' && (
            <div className="earnings-section">
              {/* Filter Controls */}
              <div className="filter-controls">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search by Order ID, Customer, or Vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="filter-options">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-select"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                    <option value="commission">Sort by Commission</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="btn btn-secondary btn-sm"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
              
              <div className="earnings-table-container">
                <table className="earnings-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Vendor</th>
                      <th>Order Amount</th>
                      <th>Commission</th>
                      <th>Vendor Earnings</th>
                      <th>Payment Method</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedData(getFilteredPayments()).map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.orderId}</td>
                        <td>{payment.customerName}</td>
                        <td>{getVendorName(payment.vendorId)}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td className="commission">{formatCurrency(payment.commission)}</td>
                        <td>{formatCurrency(payment.vendorEarnings)}</td>
                        <td>{payment.paymentMethod}</td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(payment.status)}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td>{payment.date ? formatDate(payment.date) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Vendor Payouts Tab */}
          {activeTab === 'payouts' && (
            <div className="payouts-section">
              <div className="vendors-balance">
                <h3>Vendor Balances</h3>
                <div className="vendors-grid">
                  {vendors.map((vendor) => (
                    <div key={vendor.id} className="vendor-balance-card">
                      <div className="vendor-info">
                        <img src={vendor.logo || '/default-vendor.png'} alt={vendor.companyName} />
                        <div>
                          <h4>{vendor.companyName}</h4>
                          <p>{vendor.email}</p>
                        </div>
                      </div>
                      <div className="balance-info">
                        <div className="balance-amount">
                          <span>Available Balance</span>
                          <strong>{formatCurrency(getVendorBalance(vendor.id))}</strong>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedVendor(vendor);
                            setPayoutAmount(getVendorBalance(vendor.id).toString());
                            setShowPayoutModal(true);
                          }}
                          className="btn btn-primary btn-sm"
                          disabled={getVendorBalance(vendor.id) <= 0}
                        >
                          Process Payout
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal Requests Tab */}
          {activeTab === 'withdrawals' && (
            <div className="withdrawals-section">
              {/* Filter Controls */}
              <div className="filter-controls">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search by Vendor or Payment Method..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="filter-options">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-select"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="btn btn-secondary btn-sm"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
              
              <div className="withdrawals-table-container">
                <table className="withdrawals-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Amount</th>
                      <th>Payment Method</th>
                      <th>Account Details</th>
                      <th>Request Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedData(getFilteredWithdrawals()).map((withdrawal) => (
                      <tr key={withdrawal.id}>
                        <td>{withdrawal.vendorName}</td>
                        <td>{formatCurrency(withdrawal.amount)}</td>
                        <td>{withdrawal.paymentMethod}</td>
                        <td>{withdrawal.accountDetails}</td>
                        <td>{withdrawal.requestDate ? formatDate(withdrawal.requestDate) : '-'}</td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(withdrawal.status)}`}>
                            {withdrawal.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            {withdrawal.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedWithdrawal(withdrawal);
                                    setShowWithdrawalModal(true);
                                  }}
                                  className="btn btn-info btn-sm"
                                >
                                  View Details
                                </button>
                                <button
                                  onClick={() => handleWithdrawalAction(withdrawal.id, 'approved')}
                                  className="btn btn-success btn-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleWithdrawalAction(withdrawal.id, 'rejected')}
                                  className="btn btn-danger btn-sm"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {withdrawal.status !== 'pending' && (
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(withdrawal);
                                  setShowWithdrawalModal(true);
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                View Details
                              </button>
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
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Withdrawal Details Modal */}
      {showWithdrawalModal && selectedWithdrawal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Withdrawal Details</h2>
              <button onClick={() => setShowWithdrawalModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="withdrawal-details">
                <div className="detail-group">
                  <label>Vendor:</label>
                  <span>{selectedWithdrawal.vendorName}</span>
                </div>
                <div className="detail-group">
                  <label>Amount:</label>
                  <span>{formatCurrency(selectedWithdrawal.amount)}</span>
                </div>
                <div className="detail-group">
                  <label>Payment Method:</label>
                  <span>{selectedWithdrawal.paymentMethod}</span>
                </div>
                <div className="detail-group">
                  <label>Account Details:</label>
                  <span>{selectedWithdrawal.accountDetails}</span>
                </div>
                <div className="detail-group">
                  <label>Request Date:</label>
                  <span>{selectedWithdrawal.requestDate ? formatDateTime(selectedWithdrawal.requestDate) : '-'}</span>
                </div>
                <div className="detail-group">
                  <label>Status:</label>
                  <span className={`status-badge ${getStatusBadgeClass(selectedWithdrawal.status)}`}>
                    {selectedWithdrawal.status}
                  </span>
                </div>
                {selectedWithdrawal.processedDate && (
                  <div className="detail-group">
                    <label>Processed Date:</label>
                    <span>{selectedWithdrawal.processedDate ? formatDateTime(selectedWithdrawal.processedDate) : '-'}</span>
                  </div>
                )}
                {selectedWithdrawal.rejectionReason && (
                  <div className="detail-group">
                    <label>Rejection Reason:</label>
                    <span>{selectedWithdrawal.rejectionReason}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowWithdrawalModal(false)} className="btn btn-secondary">
                Close
              </button>
              {selectedWithdrawal.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleWithdrawalAction(selectedWithdrawal.id, 'approved')}
                    className="btn btn-success"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleWithdrawalAction(selectedWithdrawal.id, 'rejected')}
                    className="btn btn-danger"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Payout Modal */}
      {showPayoutModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Manual Payout</h2>
              <button onClick={() => setShowPayoutModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="payout-form">
                <div className="form-group">
                  <label>Select Vendor:</label>
                  <select
                    value={selectedVendor?.id || ''}
                    onChange={(e) => {
                      const vendor = vendors.find(v => v.id === parseInt(e.target.value));
                      setSelectedVendor(vendor);
                      if (vendor) {
                        setPayoutAmount(getVendorBalance(vendor.id).toString());
                      }
                    }}
                  >
                    <option value="">Choose a vendor</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.companyName} (Balance: {formatCurrency(getVendorBalance(vendor.id))})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payout Amount:</label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    max={selectedVendor ? getVendorBalance(selectedVendor.id) : 0}
                  />
                </div>
                {selectedVendor && (
                  <div className="balance-info">
                    <p>Available Balance: <strong>{formatCurrency(getVendorBalance(selectedVendor.id))}</strong></p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPayoutModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleManualPayout}
                className="btn btn-primary"
                disabled={!selectedVendor || !payoutAmount || parseFloat(payoutAmount) <= 0}
              >
                Process Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments; 