import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Customers.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminUsers = () => {
  const [tab, setTab] = useState('admins'); // 'admins' | 'vendorUsers'
  const [admins, setAdmins] = useState([]);
  const [vendorUsers, setVendorUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  const authHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
  };

  useEffect(() => {
    loadLists();
  }, [tab]);

  const loadLists = async () => {
    try {
      setLoading(true);
      if (tab === 'admins') {
        const res = await fetch(`${API_BASE}/api/v1/admins`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Failed to load admins');
        setAdmins(json.data || []);
      } else {
        const [vuRes, vRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/vendor-users`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/v1/vendors?page=1&limit=1000`, { headers: authHeaders() })
        ]);
        const [vuJson, vJson] = await Promise.all([vuRes.json(), vRes.json()]);
        if (!vuRes.ok) throw new Error(vuJson?.message || 'Failed to load vendor users');
        if (!vRes.ok) throw new Error(vJson?.message || 'Failed to load vendors');
        setVendorUsers(vuJson.data || []);
        setVendors((vJson.data || []).map(v => ({ id: v._id, name: v.companyName })));
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    reset();
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    if (tab === 'admins') {
      setValue('name', item.name);
      setValue('email', item.email);
      setValue('password', '');
      setValue('isActive', item.isActive);
    } else {
      setValue('name', item.name);
      setValue('email', item.email);
      setValue('password', '');
      setValue('vendor', item.vendor?._id || item.vendor || '');
      setValue('permissions', item.permissions || []);
      setValue('isActive', item.isActive);
    }
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (tab === 'admins') {
        if (editingItem) {
          const res = await fetch(`${API_BASE}/api/v1/admins/${editingItem.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password || undefined, isActive: !!data.isActive }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to update admin');
          toast.success('Admin updated');
        } else {
          const res = await fetch(`${API_BASE}/api/v1/admins`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password, isActive: !!data.isActive }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to create admin');
          toast.success('Admin created');
        }
      } else {
        if (editingItem) {
          const res = await fetch(`${API_BASE}/api/v1/vendor-users/${editingItem._id || editingItem.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password || undefined, vendor: data.vendor, permissions: data.permissions || [], isActive: !!data.isActive }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to update vendor user');
          toast.success('Vendor user updated');
        } else {
          const res = await fetch(`${API_BASE}/api/v1/vendor-users`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password, vendor: data.vendor, permissions: data.permissions || [], isActive: !!data.isActive }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to create vendor user');
          toast.success('Vendor user created');
        }
      }
      setShowModal(false);
      setEditingItem(null);
      loadLists();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const askDelete = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      if (tab === 'admins') {
        const res = await fetch(`${API_BASE}/api/v1/admins/${itemToDelete.id}`, { method: 'DELETE', headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to delete admin');
      } else {
        const res = await fetch(`${API_BASE}/api/v1/vendor-users/${itemToDelete._id || itemToDelete.id}`, { method: 'DELETE', headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to delete vendor user');
      }
      toast.success('Deleted');
      setShowDeleteModal(false);
      setItemToDelete(null);
      loadLists();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="customers">
      <div className="page-header">
        <h2>Users Management</h2>
        <p>Manage admin users and vendor users</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn ${tab==='admins'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('admins')}>Admin Users</button>
        <button className={`btn ${tab==='vendorUsers'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('vendorUsers')}>Vendor Users</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={openAdd}>Add {tab==='admins'?'Admin':'Vendor User'}</button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                {tab==='vendorUsers' && <th>Vendor</th>}
                {tab==='vendorUsers' && <th>Permissions</th>}
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(tab==='admins' ? admins : vendorUsers).map(item => (
                <tr key={item.id || item._id}>
                  <td>
                    <div className="customer-info">
                      <strong>{item.name}</strong>
                      <span>ID: {item.id || item._id}</span>
                    </div>
                  </td>
                  <td>{item.email}</td>
                  {tab==='vendorUsers' && <td>{item.vendor?.companyName || item.vendor}</td>}
                  {tab==='vendorUsers' && (
                    <td>
                      {(item.permissions || []).length ? (item.permissions || []).join(', ') : '—'}
                    </td>
                  )}
                  <td>
                    <span className={`badge badge-${item.isActive ? 'success' : 'secondary'}`}>
                      {item.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-sm btn-primary" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => askDelete(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingItem ? 'Edit' : 'Add'} {tab==='admins'?'Admin':'Vendor User'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input type="text" className={`form-control ${errors.name ? 'error' : ''}`} {...register('name', { required: 'Name is required' })} />
                  {errors.name && <span className="error-message">{errors.name.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className={`form-control ${errors.email ? 'error' : ''}`} {...register('email', { required: 'Email is required' })} />
                  {errors.email && <span className="error-message">{errors.email.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password {editingItem && '(leave blank to keep)'}</label>
                  <input type="password" className={`form-control ${errors.password ? 'error' : ''}`} {...register('password', { required: editingItem ? false : 'Password is required' })} />
                  {errors.password && <span className="error-message">{errors.password.message}</span>}
                </div>
                {tab==='vendorUsers' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Vendor</label>
                      <select className={`form-control ${errors.vendor ? 'error' : ''}`} {...register('vendor', { required: 'Vendor is required' })}>
                        <option value="">Select Vendor</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      {errors.vendor && <span className="error-message">{errors.vendor.message}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Permissions</label>
                      <div className="permissions-checkboxes">
                        {['products.read','products.write','orders.read','orders.write','reports.read'].map(p => (
                          <label key={p} className="checkbox-label">
                            <input type="checkbox" value={p} {...register('permissions')} /> {p}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">Active</label>
                  <input type="checkbox" {...register('isActive')} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && itemToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Delete</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{tab==='admins' ? itemToDelete.name : itemToDelete.email}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers; 