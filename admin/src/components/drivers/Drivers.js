import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

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
    <div>
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
              {(drivers || []).map(d => (
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
                    {d.status === 'pending' ? (
                      rowAction[d._id || d.id] ? (
                        <span className="loading-inline">Updating...</span>
                      ) : (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(d._id || d.id, 'approved')}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(d._id || d.id, 'rejected')}>Reject</button>
                        </>
                      )
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              ))}
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
    </div>
  );
};

export default Drivers;


