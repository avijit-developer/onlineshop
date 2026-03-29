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
  
  // Get current user info
  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null');
    } catch {
      return null;
    }
  };
  const currentUser = getCurrentUser();
  const isVendor = currentUser?.role === 'vendor';
  const currentVendorId = currentUser?.vendorId || (currentUser?.vendors && currentUser.vendors[0]) || null;
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
    setLoading(true);
    try {
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      
      // For vendor users, fetch vendor-specific data
      if (isVendor && currentVendorId) {
        const [venRes, sumRes, payoutRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/vendors?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => ({ ok: true, json: async () => ({ data: [] }) })),
          fetch(`${baseUrl}/api/v1/payments/vendor-report?vendorId=${currentVendorId}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
          fetch(`${baseUrl}/api/v1/payments/payouts?vendorId=${currentVendorId}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
        ]);
        
        let vendorRows = [];
        const vendorLookup = new Map();
        if (venRes && venRes.ok) {
          const vjson = await venRes.json();
          vendorRows = (vjson.data || []).map(v => ({
            id: v._id || v.id,
            companyName: v.companyName,
            email: v.email,
            logo: v.logo
          }));
          vendorRows.forEach(v => vendorLookup.set(String(v.id), v));
        }
        setVendors(vendorRows);
        
        // Get vendor report data
        if (sumRes && sumRes.ok) {
          const reportJson = await sumRes.json();
          const reportData = reportJson.data || {};
          setVendorSummary([{
            vendorId: currentVendorId,
            vendorEarnings: reportData.totalEarnings || 0,
            paid: reportData.totalPaid || 0,
            due: reportData.balance || 0
          }]);
          // Set payments from report
          setPayments((reportData.payments || []).map((r, idx) => ({
            id: r.id || idx,
            orderId: r.orderId || '',
            customerName: r.customerName || '',
            amount: Number(r.amount || 0),
            commission: 0,
            vendorEarnings: Number(r.vendorEarnings || 0),
            paymentMethod: r.paymentMethod || '',
            status: r.status || 'pending',
            date: r.date,
            vendorId: currentVendorId,
          })));
          
          // Set payouts from report data (Admin Payments)
          if (reportData.payouts && Array.isArray(reportData.payouts)) {
            const payoutHistory = reportData.payouts.map((p) => ({
              id: p.id || p._id || String(p.id),
              vendorId: currentVendorId,
              vendorName: vendorLookup.get(String(currentVendorId))?.companyName || 'Unknown Vendor',
              amount: Number(p.amount || 0),
              status: 'approved',
              paymentMethod: p.method || 'Manual',
              accountDetails: p.note || 'N/A',
              requestDate: p.createdAt,
              processedDate: p.updatedAt || p.createdAt,
              note: p.note || '',
              processedBy: p.processedBy || (typeof p.processedBy === 'object' ? (p.processedBy.name || p.processedBy.email || '') : '')
            }));
            setWithdrawals(payoutHistory);
          }
        }
        
        // Also get payout history from separate endpoint as fallback
        if (payoutRes && payoutRes.ok) {
          const pj = await payoutRes.json();
          const payoutHistory = (pj?.data || []).map((p) => ({
            id: p.id || p._id,
            vendorId: p.vendorId || currentVendorId,
            vendorName: p.vendorName || vendorLookup.get(String(p.vendorId || currentVendorId))?.companyName || 'Unknown Vendor',
            amount: Number(p.amount || 0),
            status: 'approved',
            paymentMethod: p.method || 'Manual',
            accountDetails: p.note || 'N/A',
            requestDate: p.createdAt,
            processedDate: p.updatedAt || p.createdAt,
            note: p.note || '',
            processedBy: p.processedBy || (typeof p.processedBy === 'object' ? (p.processedBy.name || p.processedBy.email || '') : '')
          }));
          // Merge with existing withdrawals if any
          if (payoutHistory.length > 0) {
            setWithdrawals(prev => {
              const existingIds = new Set(prev.map(w => w.id));
              const newPayouts = payoutHistory.filter(p => !existingIds.has(p.id));
              return [...prev, ...newPayouts];
            });
          }
        }
        setLoading(false);
        return;
      }
      
      // Admin path - original code
      const [earnRes, venRes, sumRes, payoutRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/payments/admin-earnings?status=completed`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${baseUrl}/api/v1/vendors?page=1&limit=1000`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => ({ ok: true, json: async () => ({ data: [] }) })),
        fetch(`${baseUrl}/api/v1/payments/vendor-summary?status=completed`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${baseUrl}/api/v1/payments/payouts`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      ]);

      let vendorRows = [];
      const vendorLookup = new Map();
      if (venRes && venRes.ok) {
        const vjson = await venRes.json();
        vendorRows = (vjson.data || []).map(v => ({
          id: v._id || v.id,
          companyName: v.companyName,
          email: v.email,
          logo: v.logo
        }));
        vendorRows.forEach(v => vendorLookup.set(String(v.id), v));
      }
      setVendors(vendorRows);

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

      let vendorSummaryData = [];
      if (sumRes && sumRes.ok) {
        const sj = await sumRes.json();
        vendorSummaryData = sj?.data || [];
      }
      setVendorSummary(vendorSummaryData);

      if (!payoutRes.ok) throw new Error('Failed to load payouts');
      const pj = await payoutRes.json();
      const payoutHistory = (pj?.data || []).map((p) => ({
        id: p.id || p._id,
        vendorId: p.vendorId,
        vendorName: p.vendorName || vendorLookup.get(String(p.vendorId))?.companyName || 'Unknown Vendor',
        amount: Number(p.amount || 0),
        status: 'approved',
        paymentMethod: p.method || 'Manual',
        accountDetails: p.note || 'N/A',
        requestDate: p.createdAt,
        processedDate: p.updatedAt,
        note: p.note || '',
        processedBy: p.processedBy || ''
      }));

      const pendingRequests = vendorSummaryData
        .filter(v => Number(v.due ?? (v.vendorEarnings - (v.paid || 0))) > 0)
        .map(v => {
          const vendor = vendorLookup.get(String(v.vendorId));
          const pendingAmount = Number(v.due ?? (v.vendorEarnings - (v.paid || 0)));
          return {
            id: `pending-${v.vendorId}`,
            vendorId: v.vendorId,
            vendorName: vendor?.companyName || 'Unknown Vendor',
            amount: round2(pendingAmount),
            status: 'pending',
            paymentMethod: '—',
            accountDetails: vendor?.email || '—',
            requestDate: new Date().toISOString(),
            processedDate: null,
            note: 'Outstanding balance',
          };
        });

      const combinedWithdrawals = [...pendingRequests, ...payoutHistory];
      setWithdrawals(combinedWithdrawals);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
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

  const handleWithdrawalAction = (withdrawalId) => {
    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) return;
    setShowWithdrawalModal(false);
    const vendor = vendors.find(v => String(v.id) === String(withdrawal.vendorId));
    if (!vendor) {
      toast.error('Vendor details not found. Please refresh data.');
      return;
    }
    const availableBalance = getVendorBalance(vendor.id);
    if (!(availableBalance > 0)) {
      toast.error('Vendor has no payable balance right now.');
      return;
    }
    setSelectedVendor(vendor);
    const requestedAmount = Number(withdrawal.amount || availableBalance);
    const prefillAmount = Math.min(availableBalance, requestedAmount);
    setPayoutAmount(prefillAmount.toFixed(2));
    setShowPayoutModal(true);
  };

  const handleManualPayout = async () => {
    if (!selectedVendor || !payoutAmount) return;
    try {
      const availableBalance = getVendorBalance(selectedVendor.id);
      const amountValue = round2(Number(payoutAmount));
      if (!(amountValue > 0)) {
        toast.error('Enter a valid payout amount');
        return;
      }
      if (amountValue - availableBalance > 0.01) {
        toast.error('Payout amount exceeds available balance');
        return;
      }
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const resp = await fetch(`${baseUrl}/api/v1/payments/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          vendorId: selectedVendor.id,
          amount: amountValue,
          method: 'Manual',
          note: 'Admin manual payout'
        })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.message || 'Failed to record payout');
      await fetchData();
      setShowPayoutModal(false);
      setPayoutAmount('');
      toast.success('Manual payout processed successfully');
    } catch (e) {
      toast.error(e?.message || 'Failed to process payout');
    }
  };

  const handleDeleteWithdrawal = async (withdrawal) => {
    if (!withdrawal || withdrawal.status !== 'approved') return;
    const payoutId = withdrawal.id;
    if (!payoutId || String(payoutId).startsWith('pending-')) {
      toast.error('Only recorded payouts can be deleted');
      return;
    }
    if (!window.confirm('Delete this payout record? This will restore the amount to the vendor balance.')) return;
    try {
      const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      const baseUrl = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
      const token = localStorage.getItem('adminToken');
      const resp = await fetch(`${baseUrl}/api/v1/payments/payouts/${payoutId}`, {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) throw new Error(json?.message || 'Failed to delete payout');
      await fetchData();
      toast.success('Payout deleted successfully');
    } catch (e) {
      toast.error(e?.message || 'Failed to delete payout');
    }
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
    return round2(
      withdrawals
        .filter(w => w.status === 'approved')
        .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0)
    );
  };

  const getPendingWithdrawalAmount = () => {
    return round2(
      withdrawals
        .filter(w => w.status === 'pending')
        .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0)
    );
  };

  const getVendorBalance = (vendorId) => {
    const vs = vendorSummary.find(v => String(v.vendorId) === String(vendorId));
    return round2(vs ? Number(vs.due ?? (vs.vendorEarnings - (vs.paid || 0))) : 0);
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

  const escapeCsv = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const buildPaymentsCsv = (rows) => {
    const headers = [
      'Payment ID',
      'Order ID',
      'Customer',
      'Vendor',
      'Commission',
      'Vendor Earnings',
      'Amount',
      'Payment Method',
      'Status',
      'Date'
    ];
    const lines = [headers.map(escapeCsv).join(',')];
    rows.forEach((p) => {
      const row = [
        p.id,
        p.orderId,
        p.customerName,
        isVendor ? '' : getVendorName(p.vendorId),
        isVendor ? '' : p.commission,
        p.vendorEarnings,
        p.amount,
        p.paymentMethod,
        p.status,
        p.date ? formatDateTime(p.date) : ''
      ].map(escapeCsv).join(',');
      lines.push(row);
    });
    return lines.join('\n');
  };

  const buildWithdrawalsCsv = (rows) => {
    const headers = [
      'Withdrawal ID',
      'Vendor',
      'Amount',
      'Status',
      'Payment Method',
      'Account Details',
      'Request Date',
      'Processed Date',
      'Processed By',
      'Note'
    ];
    const lines = [headers.map(escapeCsv).join(',')];
    rows.forEach((w) => {
      const row = [
        w.id,
        w.vendorName || getVendorName(w.vendorId),
        w.amount,
        w.status,
        w.paymentMethod,
        w.accountDetails,
        w.requestDate ? formatDateTime(w.requestDate) : '',
        w.processedDate ? formatDateTime(w.processedDate) : '',
        w.processedBy || '',
        w.note || ''
      ].map(escapeCsv).join(',');
      lines.push(row);
    });
    return lines.join('\n');
  };

  const downloadCsv = (rows, label, builder) => {
    if (!rows || rows.length === 0) {
      toast.error('No records to export');
      return;
    }
    const csv = builder(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateTag = new Date().toISOString().slice(0, 10);
    a.download = `payments-${label}-${dateTag}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  if (loading) {
    return <div className="loading">Loading payments...</div>;
  }

  return (
    <div className="payments-container">
      <div className="page-header">
        <h1>Payments & Transactions</h1>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'earnings' && (
            <>
              <button
                className="btn btn-success"
                onClick={() => downloadCsv(getFilteredPayments(), 'earnings', buildPaymentsCsv)}
                title="Download payment transactions as CSV"
              >
                Download CSV
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => downloadCsv(getPaginatedData(getFilteredPayments()), 'earnings-page', buildPaymentsCsv)}
                title="Download current page as CSV"
              >
                CSV (This Page)
              </button>
            </>
          )}
          {activeTab === 'withdrawals' && (
            <>
              <button
                className="btn btn-success"
                onClick={() => downloadCsv(getFilteredWithdrawals(), 'withdrawals', buildWithdrawalsCsv)}
                title="Download withdrawal transactions as CSV"
              >
                Download CSV
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => downloadCsv(getPaginatedData(getFilteredWithdrawals()), 'withdrawals-page', buildWithdrawalsCsv)}
                title="Download current page as CSV"
              >
                CSV (This Page)
              </button>
            </>
          )}
        </div>
      </div>

      <div className="stats-cards">
        {isVendor ? (
          <>
            <div className="stat-card">
              <h3>Total Earnings</h3>
              <p>{formatCurrency(vendorSummary[0]?.vendorEarnings || 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Total Paid</h3>
              <p>{formatCurrency(vendorSummary[0]?.paid || 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Balance (Due)</h3>
              <p>{formatCurrency(vendorSummary[0]?.due || 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Total Transactions</h3>
              <p>{payments.length}</p>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <h3>Total Admin Earnings</h3>
              <p>{formatCurrency(getTotalEarnings())}</p>
            </div>
            <div className="stat-card">
              <h3>Total Vendor Payouts</h3>
              <p>{formatCurrency(getTotalVendorPayouts())}</p>
            </div>
            <div className="stat-card">
              <h3>Total Pending Withdrawal</h3>
              <p>{formatCurrency(getPendingWithdrawalAmount())}</p>
            </div>
            <div className="stat-card">
              <h3>Total Transactions</h3>
              <p>{payments.length}</p>
            </div>
          </>
        )}
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            {isVendor ? 'Payment History' : 'Admin Earnings'}
          </button>
          {!isVendor && (
            <button
              className={`tab ${activeTab === 'payouts' ? 'active' : ''}`}
              onClick={() => setActiveTab('payouts')}
            >
              Vendor Payouts
            </button>
          )}
          <button
            className={`tab ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            {isVendor ? 'Admin Payments' : 'Withdrawal Requests'}
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
                    placeholder={isVendor ? "Search by Order ID or Customer..." : "Search by Order ID, Customer, or Vendor..."}
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
                      {!isVendor && <th>Vendor</th>}
                      {!isVendor && <th>Commission</th>}
                      <th>{isVendor ? 'My Earnings' : 'Vendor Earnings'}</th>
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
                        {!isVendor && <td>{getVendorName(payment.vendorId)}</td>}
                        {!isVendor && <td className="commission">{formatCurrency(payment.commission)}</td>}
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
                            setPayoutAmount(getVendorBalance(vendor.id).toFixed(2));
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
                      {!isVendor && <th>Vendor</th>}
                      <th>Amount</th>
                      <th>Payment Method</th>
                      <th>{isVendor ? 'Payment Date & Time' : 'Request Date'}</th>
                      {isVendor && <th>Processed By</th>}
                      <th>Status</th>
                      {!isVendor && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedData(getFilteredWithdrawals()).length === 0 ? (
                      <tr>
                        <td colSpan={isVendor ? 5 : 7} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                          {isVendor ? 'No admin payments found' : 'No withdrawal requests found'}
                        </td>
                      </tr>
                    ) : (
                      getPaginatedData(getFilteredWithdrawals()).map((withdrawal) => (
                        <tr key={withdrawal.id}>
                          {!isVendor && <td>{withdrawal.vendorName}</td>}
                          <td>{formatCurrency(withdrawal.amount)}</td>
                          <td>{withdrawal.paymentMethod}</td>
                          <td>{withdrawal.processedDate ? formatDateTime(withdrawal.processedDate) : (withdrawal.requestDate ? formatDateTime(withdrawal.requestDate) : '-')}</td>
                          {isVendor && <td>{withdrawal.processedBy || '-'}</td>}
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(withdrawal.status)}`}>
                              {withdrawal.status}
                            </span>
                          </td>
                          {!isVendor && (
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
                                      onClick={() => handleWithdrawalAction(withdrawal.id)}
                                      className="btn btn-success btn-sm"
                                    >
                                      Approve
                                    </button>
                                  </>
                                )}
                                {withdrawal.status !== 'pending' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedWithdrawal(withdrawal);
                                        setShowWithdrawalModal(true);
                                      }}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      View Details
                                    </button>
                                    {withdrawal.status === 'approved' && !String(withdrawal.id || '').startsWith('pending-') && (
                                      <button
                                        onClick={() => handleDeleteWithdrawal(withdrawal)}
                                        className="btn btn-danger btn-sm"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
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
                    onClick={() => handleWithdrawalAction(selectedWithdrawal.id)}
                    className="btn btn-success"
                  >
                    Approve
                  </button>
                </>
              )}
              {selectedWithdrawal.status === 'approved' && !String(selectedWithdrawal.id || '').startsWith('pending-') && (
                <button
                  onClick={() => {
                    setShowWithdrawalModal(false);
                    handleDeleteWithdrawal(selectedWithdrawal);
                  }}
                  className="btn btn-danger"
                >
                  Delete
                </button>
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
              <button onClick={() => {
                setShowPayoutModal(false);
                setSelectedVendor(null);
                setPayoutAmount('');
              }} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="payout-form">
                <div className="form-group">
                  <label>Select Vendor:</label>
                  <select
                    value={selectedVendor?.id ? String(selectedVendor.id) : ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) {
                        setSelectedVendor(null);
                        setPayoutAmount('');
                        return;
                      }
                      // Try to find vendor by matching id as both string and number
                      const vendor = vendors.find(v => String(v.id) === String(selectedId) || v.id === parseInt(selectedId));
                      if (vendor) {
                        setSelectedVendor(vendor);
                        setPayoutAmount(getVendorBalance(vendor.id).toFixed(2));
                      } else {
                        setSelectedVendor(null);
                        setPayoutAmount('');
                      }
                    }}
                  >
                    <option value="">Choose a vendor</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={String(vendor.id)}>
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
              <button onClick={() => {
                setShowPayoutModal(false);
                setSelectedVendor(null);
                setPayoutAmount('');
              }} className="btn btn-secondary">
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
