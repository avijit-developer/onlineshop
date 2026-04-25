import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import './Drivers.css';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));
const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('drivers');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFrom, setCsvFrom] = useState('');
  const [csvTo, setCsvTo] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);
  const [rowAction, setRowAction] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ amount: '', method: 'Manual', note: '' });
  const [showPayoutHistoryModal, setShowPayoutHistoryModal] = useState(false);
  const [payoutHistoryLoading, setPayoutHistoryLoading] = useState(false);
  const [payoutHistorySummary, setPayoutHistorySummary] = useState({ totalEarnings: 0, totalPaid: 0, balance: 0 });
  const [payoutHistoryRows, setPayoutHistoryRows] = useState([]);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(10);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [showLedgerCsvModal, setShowLedgerCsvModal] = useState(false);
  const [ledgerCsvFrom, setLedgerCsvFrom] = useState('');
  const [ledgerCsvTo, setLedgerCsvTo] = useState('');
  const [exportingLedgerCsv, setExportingLedgerCsv] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address1: '',
    address2: '',
    city: '',
    zip: '',
    address: '',
    status: 'approved',
    enabled: true,
  });

  const getCurrentUser = () => {
    const userData = localStorage.getItem('adminUser');
    return userData ? JSON.parse(userData) : null;
  };

  const currentUser = getCurrentUser();
  const userPerms = new Set(currentUser?.permissions || []);
  const isAdmin = currentUser?.role === 'admin';
  const canAddDriver = isAdmin || userPerms.has('*') || userPerms.has('driver.add') || userPerms.has('driver.edit');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
  };

  const buildDriverQueryParams = (pageNumber, pageLimit) => {
    const qs = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') qs.append('status', statusFilter);
    if (q) qs.append('q', q);
    qs.append('page', String(pageNumber));
    qs.append('limit', String(pageLimit));
    return qs;
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const qs = buildDriverQueryParams(page, limit);
      const res = await fetch(`${API_BASE}/api/v1/drivers?${qs.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load drivers');
      setDrivers(json.data || []);
      setTotal(json?.meta?.total || 0);
    } catch (e) {
      toast.error(e?.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); /* eslint-disable-next-line */ }, [statusFilter, q, page, limit]);

  const buildPayoutLedgerQueryParams = (pageNumber, pageLimit) => {
    const qs = new URLSearchParams();
    if (ledgerSearch) qs.append('q', ledgerSearch);
    qs.append('page', String(pageNumber));
    qs.append('limit', String(pageLimit));
    return qs;
  };

  const csvValue = (value) => {
    if (value === null || value === undefined) return '';
    const normalized = Array.isArray(value) ? value.join(' | ') : String(value);
    if (/[",\n\r]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  };

  const buildDriversCsv = (rows) => {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'City',
      'ZIP',
      'Address 1',
      'Address 2',
      'Address',
      'Status',
      'Enabled',
      'Total Earnings',
      'Total Paid',
      'Due Balance',
      'Busy',
      'Active Order Count',
      'Active Order Numbers',
      'Created At',
      'Updated At',
    ];

    const csvRows = rows.map((driver) => [
      driver.name,
      driver.email,
      driver.phone,
      driver.city,
      driver.zip,
      driver.address1,
      driver.address2,
      driver.address,
      driver.status,
      driver.enabled ? 'Yes' : 'No',
      Number(driver.totalEarnings || 0).toFixed(2),
      Number(driver.totalPaid || 0).toFixed(2),
      Number(driver.balance || 0).toFixed(2),
      driver.isBusy ? 'Yes' : 'No',
      Number(driver.activeOrderCount || 0),
      driver.activeOrderNumbers || [],
      driver.createdAt ? new Date(driver.createdAt).toISOString() : '',
      driver.updatedAt ? new Date(driver.updatedAt).toISOString() : '',
    ]);

    return [headers, ...csvRows]
      .map((row) => row.map(csvValue).join(','))
      .join('\n');
  };

  const fetchAllDriversForExport = async () => {
    const pageSize = 100;
    const exportedDrivers = [];
    let currentPage = 1;
    let totalCount = null;

    while (true) {
      const qs = buildDriverQueryParams(currentPage, pageSize);
      const res = await fetch(`${API_BASE}/api/v1/drivers?${qs.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to load drivers for export');

      const items = Array.isArray(json?.data) ? json.data : [];
      exportedDrivers.push(...items);

      if (totalCount === null) {
        totalCount = Number(json?.meta?.total || items.length || 0);
      }

      if (!items.length || exportedDrivers.length >= totalCount || items.length < pageSize) {
        break;
      }

      currentPage += 1;
    }

    return exportedDrivers;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const fetchPayoutLedger = async () => {
    try {
      setLedgerLoading(true);
      const qs = buildPayoutLedgerQueryParams(ledgerPage, ledgerLimit);
      const res = await fetch(`${API_BASE}/api/v1/drivers/payouts?${qs.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to load payout ledger');
      setLedgerRows(Array.isArray(json?.data) ? json.data : []);
      setLedgerTotal(Number(json?.meta?.total || 0));
    } catch (e) {
      toast.error(e?.message || 'Failed to load payout ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'ledger') return;
    fetchPayoutLedger();
    /* eslint-disable-next-line */
  }, [activeTab, ledgerSearch, ledgerPage, ledgerLimit]);

  const fetchAllPayoutLedgerForExport = async () => {
    const pageSize = 100;
    const exportedRows = [];
    let currentPage = 1;
    let totalCount = null;

    while (true) {
      const qs = new URLSearchParams();
      if (ledgerSearch) qs.append('q', ledgerSearch);
      if (ledgerCsvFrom) qs.append('from', `${ledgerCsvFrom}T00:00:00`);
      if (ledgerCsvTo) qs.append('to', `${ledgerCsvTo}T23:59:59.999`);
      qs.append('page', String(currentPage));
      qs.append('limit', String(pageSize));

      const res = await fetch(`${API_BASE}/api/v1/drivers/payouts?${qs.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to load payout ledger for export');

      const items = Array.isArray(json?.data) ? json.data : [];
      exportedRows.push(...items);

      if (totalCount === null) {
        totalCount = Number(json?.meta?.total || items.length || 0);
      }

      if (!items.length || exportedRows.length >= totalCount || items.length < pageSize) {
        break;
      }

      currentPage += 1;
    }

    return exportedRows;
  };

  const openLedgerCsvModal = () => {
    setLedgerCsvFrom('');
    setLedgerCsvTo('');
    setShowLedgerCsvModal(true);
  };

  const exportLedgerCsvByDateRange = async () => {
    if (exportingLedgerCsv) return;
    try {
      setExportingLedgerCsv(true);
      const rows = await fetchAllPayoutLedgerForExport();
      if (!rows.length) {
        toast.error('No payout records to export');
        return;
      }

      const headers = ['Driver', 'Email', 'Phone', 'City', 'Amount', 'Method', 'Note', 'Processed By', 'Created At', 'Updated At'];
      const csv = [
        headers,
        ...rows.map((row) => [
          row.driverName,
          row.driverEmail,
          row.driverPhone,
          row.driverCity,
          Number(row.amount || 0).toFixed(2),
          row.method,
          row.note,
          row.processedBy,
          row.createdAt ? new Date(row.createdAt).toISOString() : '',
          row.updatedAt ? new Date(row.updatedAt).toISOString() : '',
        ])
      ]
        .map((row) => row.map(csvValue).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateTag = new Date().toISOString().slice(0, 10);
      a.download = `driver-payout-ledger-${dateTag}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
      setShowLedgerCsvModal(false);
    } catch (e) {
      toast.error(e?.message || 'Failed to export payout ledger');
    } finally {
      setExportingLedgerCsv(false);
    }
  };

  const openCsvModal = () => {
    setCsvFrom('');
    setCsvTo('');
    setShowCsvModal(true);
  };

  const exportCsvByDateRange = async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      const rows = await fetchAllDriversForExport();
      let filteredRows = rows;

      if (csvFrom || csvTo) {
        const from = csvFrom ? new Date(`${csvFrom}T00:00:00`) : null;
        const to = csvTo ? new Date(`${csvTo}T23:59:59.999`) : null;
        filteredRows = rows.filter((driver) => {
          if (!driver.createdAt) return false;
          const created = new Date(driver.createdAt);
          if (from && created < from) return false;
          if (to && created > to) return false;
          return true;
        });
      }

      if (!filteredRows.length) {
        toast.error('No drivers to export');
        return;
      }

      const csv = buildDriversCsv(filteredRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateTag = new Date().toISOString().slice(0, 10);
      a.download = `drivers-date-range-${dateTag}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
      setShowCsvModal(false);
    } catch (e) {
      toast.error(e?.message || 'Failed to export drivers');
    } finally {
      setExportingCsv(false);
    }
  };

  const emptyFormData = () => ({
    name: '',
    email: '',
    phone: '',
    password: '',
    address1: '',
    address2: '',
    city: '',
    zip: '',
    address: '',
    status: 'approved',
    enabled: true,
  });

  const resetAddForm = () => {
    setFormData({
      ...emptyFormData(),
    });
  };

  const openAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const openEditModal = (driver) => {
    setEditingDriverId(driver._id || driver.id);
    setFormData({
      name: driver.name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      password: '',
      address1: driver.address1 || '',
      address2: driver.address2 || '',
      city: driver.city || '',
      zip: driver.zip || '',
      address: driver.address || '',
      status: driver.status || 'pending',
      enabled: !!driver.enabled,
    });
    setShowEditModal(true);
  };

  const handleAddInput = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'status') {
        next.enabled = value === 'approved';
      }
      return next;
    });
  };

  const submitAddDriver = async (e) => {
    e.preventDefault();
    try {
      if (addSubmitting) return;
      if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
        toast.error('Name, email and phone are required');
        return;
      }
      if (!formData.password || String(formData.password).trim().length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }

      setAddSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        address1: formData.address1.trim(),
        address2: formData.address2.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
        address: formData.address.trim(),
        status: formData.status,
        enabled: formData.enabled,
      };

      const res = await fetch(`${API_BASE}/api/v1/drivers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to create driver');

      toast.success('Driver created successfully');
      setShowAddModal(false);
      resetAddForm();
      setPage(1);
      fetchDrivers();
    } catch (e2) {
      toast.error(e2?.message || 'Failed to create driver');
    } finally {
      setAddSubmitting(false);
    }
  };

  const submitEditDriver = async (e) => {
    e.preventDefault();
    try {
      if (editSubmitting || !editingDriverId) return;
      if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
        toast.error('Name, email and phone are required');
        return;
      }

      setEditSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password || undefined,
        address1: formData.address1.trim(),
        address2: formData.address2.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
        address: formData.address.trim(),
        status: formData.status,
        enabled: formData.enabled,
      };

      const res = await fetch(`${API_BASE}/api/v1/drivers/${editingDriverId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update driver');

      toast.success('Driver updated successfully');
      setShowEditModal(false);
      setEditingDriverId(null);
      setFormData(emptyFormData());
      fetchDrivers();
    } catch (e2) {
      toast.error(e2?.message || 'Failed to update driver');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      setRowAction(prev => ({ ...prev, [id]: newStatus }));
      setDrivers(prev => prev.map(d => (String(d._id || d.id) === String(id)) ? { ...d, status: newStatus, enabled: newStatus === 'approved' } : d));
      const res = await fetch(`${API_BASE}/api/v1/drivers/${id}/status`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status: newStatus }) });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update status');
      toast.success(`Driver ${newStatus}`);
      fetchDrivers();
    } catch (e) {
      toast.error(e?.message || 'Failed to update');
      fetchDrivers();
    } finally {
      setRowAction(prev => { const { [id]: _, ...rest } = prev; return rest; });
    }
  };

  const handleEnableToggle = async (driver, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/drivers/${driver._id || driver.id}/enable`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ enabled }) });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update enable status');
      fetchDrivers();
    } catch (e) { toast.error(e?.message || 'Failed'); }
  };

  const openPayoutModal = (driver) => {
    setSelectedDriver(driver);
    setPayoutForm({
      amount: String(driver.balance || ''),
      method: 'Manual',
      note: '',
    });
    setShowPayoutModal(true);
  };

  const openPayoutHistoryModal = async (driver) => {
    const driverId = driver._id || driver.id;
    if (!driverId) {
      toast.error('Driver not found');
      return;
    }

    setSelectedDriver(driver);
    setPayoutHistoryRows([]);
    setPayoutHistorySummary({
      totalEarnings: Number(driver.totalEarnings || 0),
      totalPaid: Number(driver.totalPaid || 0),
      balance: Number(driver.balance || 0),
    });
    setPayoutHistoryLoading(true);
    setShowPayoutHistoryModal(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/drivers/${driverId}/payouts`, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to load payout history');

      const data = json?.data || {};
      setPayoutHistorySummary({
        totalEarnings: Number(data.totalEarnings || 0),
        totalPaid: Number(data.totalPaid || 0),
        balance: Number(data.balance || 0),
      });
      setPayoutHistoryRows(Array.isArray(data.payouts) ? data.payouts : []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load payout history');
    } finally {
      setPayoutHistoryLoading(false);
    }
  };

  const closePayoutHistoryModal = () => {
    setShowPayoutHistoryModal(false);
    setPayoutHistoryLoading(false);
    setPayoutHistoryRows([]);
  };

  const submitPayout = async (e) => {
    e.preventDefault();
    try {
      if (!selectedDriver || payoutSubmitting) return;
      const amount = Number(payoutForm.amount);
      if (!(amount > 0)) {
        toast.error('Enter a valid payout amount');
        return;
      }
      setPayoutSubmitting(true);
      const res = await fetch(`${API_BASE}/api/v1/drivers/${selectedDriver._id || selectedDriver.id}/payouts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount,
          method: payoutForm.method,
          note: payoutForm.note,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to process payout');
      toast.success('Driver payout processed successfully');
      setShowPayoutModal(false);
      setSelectedDriver(null);
      setPayoutForm({ amount: '', method: 'Manual', note: '' });
      fetchDrivers();
    } catch (e2) {
      toast.error(e2?.message || 'Failed to process payout');
    } finally {
      setPayoutSubmitting(false);
    }
  };

  return (
    <div className="drivers-page">
      <div className="drivers-hero">
        <div>          
          <h2>Drivers</h2>
          <p className="drivers-subtitle">Manage approvals, balances, and payouts for every driver from one place.</p>
        </div>
        {canAddDriver && (
          <button className="btn btn-primary" onClick={openAddModal}>Add Driver</button>
        )}
      </div>

      <div className="drivers-stats">
        <div className="drivers-stat-card">
          <span>Total Drivers</span>
          <strong>{total || drivers.length}</strong>
        </div>
        <div className="drivers-stat-card">
          <span>Approved</span>
          <strong>{drivers.filter(d => d.status === 'approved').length}</strong>
        </div>
        <div className="drivers-stat-card">
          <span>Total Earning</span>
          <strong>{formatMoney(drivers.reduce((sum, d) => sum + Number(d.totalEarnings || 0), 0))}</strong>
        </div>
        <div className="drivers-stat-card">
          <span>Total Due</span>
          <strong>{formatMoney(drivers.reduce((sum, d) => sum + Number(d.balance || 0), 0))}</strong>
        </div>
      </div>

      <div className="drivers-view-tabs">
        <button
          type="button"
          className={`drivers-view-tab ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          Drivers
        </button>
        <button
          type="button"
          className={`drivers-view-tab ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => { setLedgerPage(1); setActiveTab('ledger'); }}
        >
          Payout Ledger
        </button>
      </div>

      {activeTab === 'drivers' && (
      <div className="card">
        <div className="drivers-toolbar">
          <div className="drivers-toolbar-filters">
            <input placeholder="Search by name, email, or phone" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="search-input drivers-search" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="filter-select">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="drivers-toolbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCsvModal}
              disabled={loading}
              title="Download filtered drivers as CSV"
            >
              Download CSV
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Total Collection</th>
                <th>Due Balance</th>
                <th>Status</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(drivers || []).length ? (
                (drivers || []).map(d => (
                  <tr key={d._id || d.id}>
                    <td>
                      <div className="driver-primary">
                        <strong>{d.name}</strong>
                        {d.city ? <small>{d.city}</small> : null}
                      </div>
                    </td>
                    <td>
                      <div className="driver-secondary">
                        <span>{d.email}</span>
                      </div>
                    </td>
                    <td>{d.phone}</td>
                    <td>{formatMoney(d.totalEarnings)}</td>
                    <td>
                      <span className={`balance-pill ${Number(d.balance || 0) > 0 ? 'due' : 'clear'}`}>
                        {formatMoney(d.balance)}
                      </span>
                    </td>
                    <td><span className={`status-badge ${d.status}`}>{d.status}</span></td>
                    <td>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={!!d.enabled} onChange={e => handleEnableToggle(d, e.target.checked)} />
                        <span className="slider" />
                      </label>
                    </td>
                    <td>
                      <div className="driver-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => openEditModal(d)}>Edit</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openPayoutHistoryModal(d)}>History</button>
                        <button className="btn btn-warning btn-sm" onClick={() => openPayoutModal(d)} disabled={Number(d.balance || 0) <= 0}>Payout</button>
                        {d.status === 'pending' ? (
                          rowAction[d._id || d.id] ? (
                            <span className="loading-inline">Updating...</span>
                          ) : (
                            <>
                              <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(d._id || d.id, 'approved')}>Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(d._id || d.id, 'rejected')}>Reject</button>
                            </>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="driver-empty">No drivers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(1)}>First</button>
          <button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
          <span className="page-info">Page {page}</span>
          <button className="btn btn-secondary" onClick={()=>setPage(p=>p+1)} disabled={drivers.length < limit}>Next</button>
          <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)||10); setPage(1); }} className="page-size-select" style={{ marginLeft: 8 }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      )}

      {activeTab === 'ledger' && (
        <div className="card">
          <div className="drivers-toolbar">
            <div className="drivers-toolbar-filters">
              <input
                placeholder="Search by driver, note, or method"
                value={ledgerSearch}
                onChange={e => { setLedgerSearch(e.target.value); setLedgerPage(1); }}
                className="search-input drivers-search"
              />
            </div>
            <div className="drivers-toolbar-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={openLedgerCsvModal}
                disabled={ledgerLoading}
                title="Download payout ledger as CSV"
              >
                Download CSV
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Note</th>
                  <th>Processed By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr>
                    <td colSpan="8" className="driver-empty">Loading payout ledger...</td>
                  </tr>
                ) : (ledgerRows || []).length ? (
                  ledgerRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="driver-primary">
                          <strong>{row.driverName}</strong>
                          {row.driverCity ? <small>{row.driverCity}</small> : null}
                        </div>
                      </td>
                      <td>{row.driverEmail || '-'}</td>
                      <td>{row.driverPhone || '-'}</td>
                      <td>{formatMoney(row.amount)}</td>
                      <td>{row.method || 'Manual'}</td>
                      <td className="driver-history-note">{row.note || '-'}</td>
                      <td>{row.processedBy || 'System'}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="driver-empty">No payout transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="btn btn-secondary" disabled={ledgerPage===1} onClick={()=>setLedgerPage(1)}>First</button>
            <button className="btn btn-secondary" disabled={ledgerPage===1} onClick={()=>setLedgerPage(p=>Math.max(1,p-1))}>Prev</button>
            <span className="page-info">Page {ledgerPage}</span>
            <button className="btn btn-secondary" onClick={()=>setLedgerPage(p=>p+1)} disabled={ledgerRows.length < ledgerLimit || ledgerPage * ledgerLimit >= ledgerTotal}>Next</button>
            <select value={ledgerLimit} onChange={e=>{ setLedgerLimit(Number(e.target.value)||10); setLedgerPage(1); }} className="page-size-select" style={{ marginLeft: 8 }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}

      {showCsvModal && (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Download Drivers CSV</h3>
              <button className="modal-close" onClick={() => setShowCsvModal(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="drivers-form-grid">
                <div className="form-group">
                  <label>From</label>
                  <input
                    type="date"
                    value={csvFrom}
                    max={csvTo || undefined}
                    onChange={(e) => setCsvFrom(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>To</label>
                  <input
                    type="date"
                    value={csvTo}
                    min={csvFrom || undefined}
                    onChange={(e) => setCsvTo(e.target.value)}
                  />
                </div>
              </div>
              <small className="driver-csv-hint">Leave empty to export all filtered drivers.</small>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCsvModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={exportCsvByDateRange} disabled={exportingCsv}>
                {exportingCsv ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLedgerCsvModal && (
        <div className="modal-overlay" onClick={() => setShowLedgerCsvModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Download Payout Ledger CSV</h3>
              <button type="button" className="modal-close" onClick={() => setShowLedgerCsvModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="drivers-form-grid">
                <div className="form-group">
                  <label>From</label>
                  <input
                    type="date"
                    value={ledgerCsvFrom}
                    max={ledgerCsvTo || undefined}
                    onChange={(e) => setLedgerCsvFrom(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>To</label>
                  <input
                    type="date"
                    value={ledgerCsvTo}
                    min={ledgerCsvFrom || undefined}
                    onChange={(e) => setLedgerCsvTo(e.target.value)}
                  />
                </div>
              </div>
              <small className="driver-csv-hint">Leave empty to export all payout transactions.</small>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowLedgerCsvModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={exportLedgerCsvByDateRange} disabled={exportingLedgerCsv}>
                {exportingLedgerCsv ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Driver</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={submitAddDriver}>
              <div className="modal-body">
                <div className="drivers-form-grid">
                  <div className="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleAddInput} required />
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
                    <label>Password *</label>
                    <input type="password" name="password" value={formData.password} onChange={handleAddInput} required />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleAddInput}>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Address 1</label>
                    <input type="text" name="address1" value={formData.address1} onChange={handleAddInput} />
                  </div>
                  <div className="form-group">
                    <label>Address 2</label>
                    <input type="text" name="address2" value={formData.address2} onChange={handleAddInput} />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" name="city" value={formData.city} onChange={handleAddInput} />
                  </div>
                  <div className="form-group">
                    <label>ZIP / PIN</label>
                    <input type="text" name="zip" value={formData.zip} onChange={handleAddInput} />
                  </div>
                  <div className="form-group full-width">
                    <label>Address / Notes</label>
                    <textarea name="address" value={formData.address} onChange={handleAddInput} />
                  </div>
                  <div className="form-group full-width">
                    <label className="driver-status-toggle">
                      <input type="checkbox" name="enabled" checked={!!formData.enabled} onChange={handleAddInput} disabled={formData.status !== 'approved'} />
                      <span>Enable driver immediately</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addSubmitting}>{addSubmitting ? 'Saving...' : 'Add Driver'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Driver</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={submitEditDriver}>
              <div className="modal-body">
                <div className="drivers-form-grid">
                  <div className="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleAddInput} required />
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
                    <label>Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleAddInput} placeholder="Leave blank to keep current password" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleAddInput}>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Address 1</label>
                    <input type="text" name="address1" value={formData.address1} onChange={handleAddInput} />
                  </div>
                  <div className="form-group">
                    <label>Address 2</label>
                    <input type="text" name="address2" value={formData.address2} onChange={handleAddInput} />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" name="city" value={formData.city} onChange={handleAddInput} />
                  </div>
                  <div className="form-group">
                    <label>ZIP / PIN</label>
                    <input type="text" name="zip" value={formData.zip} onChange={handleAddInput} />
                  </div>
                  <div className="form-group full-width">
                    <label>Address / Notes</label>
                    <textarea name="address" value={formData.address} onChange={handleAddInput} />
                  </div>
                  <div className="form-group full-width">
                    <label className="driver-status-toggle">
                      <input type="checkbox" name="enabled" checked={!!formData.enabled} onChange={handleAddInput} disabled={formData.status !== 'approved'} />
                      <span>Enable driver</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Update Driver'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayoutModal && selectedDriver && (
        <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Driver Payout</h3>
              <button className="modal-close" onClick={() => setShowPayoutModal(false)}>✕</button>
            </div>
            <form onSubmit={submitPayout}>
              <div className="modal-body">
                <div className="driver-payout-summary">
                  <div><strong>Driver:</strong> {selectedDriver.name}</div>
                  <div><strong>Total Earnings:</strong> {formatMoney(selectedDriver.totalEarnings)}</div>
                  <div><strong>Due Balance:</strong> {formatMoney(selectedDriver.balance)}</div>
                </div>
                <div className="drivers-form-grid">
                  <div className="form-group">
                    <label>Payout Amount *</label>
                    <input type="number" min="0" step="0.01" value={payoutForm.amount} onChange={e => setPayoutForm(prev => ({ ...prev, amount: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Method</label>
                    <select value={payoutForm.method} onChange={e => setPayoutForm(prev => ({ ...prev, method: e.target.value }))}>
                      <option value="Manual">Manual</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Note</label>
                    <textarea value={payoutForm.note} onChange={e => setPayoutForm(prev => ({ ...prev, note: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayoutModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-warning" disabled={payoutSubmitting}>{payoutSubmitting ? 'Processing...' : 'Pay Driver'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayoutHistoryModal && selectedDriver && (
        <div className="modal-overlay" onClick={closePayoutHistoryModal}>
          <div className="modal driver-history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Payout Transaction History</h3>
              <button type="button" className="modal-close" onClick={closePayoutHistoryModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="driver-history-summary">
                <div className="driver-history-summary-item">
                  <span>Driver</span>
                  <strong>{selectedDriver.name}</strong>
                </div>
                <div className="driver-history-summary-item">
                  <span>Total Earnings</span>
                  <strong>{formatMoney(payoutHistorySummary.totalEarnings)}</strong>
                </div>
                <div className="driver-history-summary-item">
                  <span>Total Paid</span>
                  <strong>{formatMoney(payoutHistorySummary.totalPaid)}</strong>
                </div>
                <div className="driver-history-summary-item">
                  <span>Due Balance</span>
                  <strong>{formatMoney(payoutHistorySummary.balance)}</strong>
                </div>
              </div>

              {payoutHistoryLoading ? (
                <div className="driver-history-loading">Loading payout history...</div>
              ) : payoutHistoryRows.length ? (
                <div className="table-responsive driver-history-table-wrap">
                  <table className="table driver-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Note</th>
                        <th>Processed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistoryRows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDateTime(row.createdAt)}</td>
                          <td>{formatMoney(row.amount)}</td>
                          <td>{row.method || 'Manual'}</td>
                          <td className="driver-history-note">{row.note || '-'}</td>
                          <td>
                            {row.processedBy
                              ? [row.processedBy.name, row.processedBy.email].filter(Boolean).join(' - ')
                              : 'System'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="driver-history-empty">No payout transactions found for this driver.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closePayoutHistoryModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;


