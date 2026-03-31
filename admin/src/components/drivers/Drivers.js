import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import './Drivers.css';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [rowAction, setRowAction] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState(null);
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

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') qs.append('status', statusFilter);
      if (q) qs.append('q', q);
      qs.append('page', String(page));
      qs.append('limit', String(limit));
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

  return (
    <div className="drivers-page">
      <div className="page-header">
        <h2>Drivers</h2>
        <div className="header-actions" style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input placeholder="Search..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="search-input" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="filter-select">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {canAddDriver && (
            <button className="btn btn-primary" onClick={openAddModal}>Add Driver</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(drivers || []).length ? (
                (drivers || []).map(d => (
                  <tr key={d._id || d.id}>
                    <td>{d.name}</td>
                    <td>{d.email}</td>
                    <td>{d.phone}</td>
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
                  <td colSpan="6" className="driver-empty">No drivers found.</td>
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
    </div>
  );
};

export default Drivers;


