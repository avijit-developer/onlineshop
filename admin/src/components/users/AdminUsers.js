import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Customers.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminUsers = () => {
  const [tab, setTab] = useState('admins'); // 'admins' | 'vendorUsers' | 'roles'
  const [admins, setAdmins] = useState([]);
  const [vendorUsers, setVendorUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  const authHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
  };

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (showModal && tab === 'vendorUsers' && roles.length === 0) {
      loadLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, tab, roles.length]);

  const loadLists = async () => {
    try {
      setLoading(true);
      if (tab === 'admins') {
        const res = await fetch(`${API_BASE}/api/v1/admins`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Failed to load admins');
        setAdmins(json.data || []);
      } else if (tab === 'vendorUsers') {
        const [vuRes, vRes, rRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/vendor-users`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/v1/vendors?page=1&limit=1000`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/v1/roles`, { headers: authHeaders() })
        ]);
        const [vuJson, vJson, rJson] = await Promise.all([vuRes.json(), vRes.json(), rRes.json()]);
        if (!vuRes.ok) throw new Error(vuJson?.message || 'Failed to load vendor users');
        if (!vRes.ok) throw new Error(vJson?.message || 'Failed to load vendors');
        if (!rRes.ok) throw new Error(rJson?.message || 'Failed to load roles');
        setVendorUsers(vuJson.data || []);
        setVendors((vJson.data || []).map(v => ({ id: v._id, name: v.companyName })));
        setRoles(rJson.data || []);
      } else {
        const rRes = await fetch(`${API_BASE}/api/v1/roles`, { headers: authHeaders() });
        const rJson = await rRes.json();
        if (!rRes.ok) throw new Error(rJson?.message || 'Failed to load roles');
        setRoles(rJson.data || []);
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
    setSelectedVendorIds([]);
    setShowModal(true);
  };

  const openEdit = (item, itemType = null) => {
    setEditingItem(item);
    // Ensure form values are set after modal opens
    setTimeout(() => {
      const currentTab = itemType || tab;
      if (currentTab === 'admins') {
        setValue('name', item.name);
        setValue('email', item.email);
        setValue('password', '');
        setValue('isActive', item.isActive);
      } else if (currentTab === 'vendorUsers') {
        setValue('name', item.name);
        setValue('email', item.email);
        setValue('password', '');
        // Vendors
        let vendorIds = [];
        if (Array.isArray(item.vendors) && item.vendors.length > 0) {
          vendorIds = item.vendors.map(v => v._id || v);
        } else if (item.vendor) {
          vendorIds = [item.vendor._id || item.vendor];
        }
        const vendorIdsStr = (vendorIds || []).map(v => String(v));
        setValue('vendors', vendorIdsStr);
        setSelectedVendorIds(vendorIdsStr);
        // Role
        let roleId = '';
        if (item.roleRef) {
          roleId = typeof item.roleRef === 'object' ? item.roleRef._id : item.roleRef;
        } else if (item.role) {
          roleId = typeof item.role === 'object' ? item.role._id : item.role;
        }
        setValue('roleRef', roleId);
        setValue('isActive', item.isActive);
      } else if (currentTab === 'roles') {
        setValue('name', item.name);
        setValue('description', item.description || '');
        setValue('permissions', item.permissions || []);
      }
    }, 50);
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
      } else if (tab === 'roles') {
        if (editingItem) {
          const res = await fetch(`${API_BASE}/api/v1/roles/${editingItem.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: data.name, description: data.description, permissions: data.permissions || [] }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to update role');
          toast.success('Role updated');
        } else {
          const res = await fetch(`${API_BASE}/api/v1/roles`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: data.name, description: data.description, permissions: data.permissions || [] }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to create role');
          toast.success('Role created');
        }
      } else {
        if (editingItem) {
          const res = await fetch(`${API_BASE}/api/v1/vendor-users/${editingItem._id || editingItem.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password || undefined, vendors: data.vendors || [], roleRef: data.roleRef || undefined, isActive: !!data.isActive }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to update vendor user');
          toast.success('Vendor user updated');
        } else {
          const res = await fetch(`${API_BASE}/api/v1/vendor-users`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password, vendors: data.vendors || [], roleRef: data.roleRef || undefined, isActive: !!data.isActive }) });
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
      } else if (tab === 'roles') {
        const res = await fetch(`${API_BASE}/api/v1/roles/${itemToDelete.id}`, { method: 'DELETE', headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'Failed to delete role');
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
        <p>Manage admin users, vendor users and roles</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn ${tab==='admins'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('admins')}>Admin Users</button>
        <button className={`btn ${tab==='vendorUsers'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('vendorUsers')}>Vendor Users</button>
        <button className={`btn ${tab==='roles'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('roles')}>Roles</button>
        <div style={{ flex: 1 }} />
        {tab!=='roles' ? (
          <button className="btn btn-primary" onClick={openAdd}>Add {tab==='admins'?'Admin':'Vendor User'}</button>
        ) : (
          <button className="btn btn-primary" onClick={openAdd}>Add Role</button>
        )}
      </div>

      {tab==='roles' ? (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role._id}>
                    <td>{role.name}</td>
                    <td>{role.description}</td>
                    <td>{(role.permissions||[]).join(', ')}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-sm btn-primary" onClick={() => { setTab('roles'); openEdit({ ...role, id: role._id }, 'roles'); }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => askDelete({ ...role, id: role._id })}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  {tab==='vendorUsers' && <th>Vendor</th>}
                  {tab==='vendorUsers' && <th>Role</th>}
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
                    {tab==='vendorUsers' && (
                      <td>
                        {item.vendors && Array.isArray(item.vendors) ? 
                          item.vendors.map(v => v.companyName || v).join(', ') : 
                          item.vendor?.companyName || item.vendor || '—'
                        }
                      </td>
                    )}
                    {tab==='vendorUsers' && (
                      <td>
                        {item.roleRef?.name || item.roleRef || '—'}
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
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingItem ? 'Edit' : 'Add'} {tab==='admins'?'Admin': tab==='vendorUsers' ? 'Vendor User' : 'Role'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="modal-body">
                {tab==='roles' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input type="text" className={`form-control ${errors.name ? 'error' : ''}`} {...register('name', { required: 'Name is required' })} />
                      {errors.name && <span className="error-message">{errors.name.message}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input type="text" className="form-control" {...register('description')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Permissions</label>
                      <div style={{ marginBottom: 8 }}>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              const selectAll = e.target.checked;
                              const all = [
                                'products.view','products.add','products.edit','products.delete',
                                'orders.view','orders.add','orders.edit','orders.delete',
                                'reports.view',
                                'vendor.add','vendor.edit','vendor.delete'
                              ];
                              setValue('permissions', selectAll ? all : []);
                            }}
                          /> Select All
                        </label>
                      </div>
                      <details>
                        <summary>Products</summary>
                        <div className="permissions-checkboxes">
                          {['products.view','products.add','products.edit','products.delete'].map(p => (
                            <label key={p} className="checkbox-label">
                              <input type="checkbox" value={p} {...register('permissions')} /> {p.split('.')[1]}
                            </label>
                          ))}
                        </div>
                      </details>
                      <details>
                        <summary>Orders</summary>
                        <div className="permissions-checkboxes">
                          {['orders.view','orders.add','orders.edit','orders.delete'].map(p => (
                            <label key={p} className="checkbox-label">
                              <input type="checkbox" value={p} {...register('permissions')} /> {p.split('.')[1]}
                            </label>
                          ))}
                        </div>
                      </details>
                      <details>
                        <summary>Reports</summary>
                        <div className="permissions-checkboxes">
                          {['reports.view'].map(p => (
                            <label key={p} className="checkbox-label">
                              <input type="checkbox" value={p} {...register('permissions')} /> {p.split('.')[1]}
                            </label>
                          ))}
                        </div>
                      </details>
                      <details>
                        <summary>Vendor</summary>
                        <div className="permissions-checkboxes">
                          {['vendor.add','vendor.edit','vendor.delete'].map(p => (
                            <label key={p} className="checkbox-label">
                              <input type="checkbox" value={p} {...register('permissions')} /> {p.split('.')[1]}
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  </>
                ) : (
                  <>
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
                          <label className="form-label">Vendors</label>
                          <div className="vendor-checkboxes">
                            {vendors.map(v => (
                              <label key={v.id} className="checkbox-label">
                                <input
                                  type="checkbox"
                                  value={v.id}
                                  checked={selectedVendorIds.includes(String(v.id))}
                                  onChange={(e) => {
                                    const id = String(v.id);
                                    const next = e.target.checked
                                      ? Array.from(new Set([...selectedVendorIds, id]))
                                      : selectedVendorIds.filter(x => x !== id);
                                    setSelectedVendorIds(next);
                                    setValue('vendors', next);
                                  }}
                                /> {v.name}
                              </label>
                            ))}
                          </div>
                          {errors.vendors && <span className="error-message">{errors.vendors.message}</span>}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Role</label>
                          <select className="form-control" {...register('roleRef')} onChange={(e) => setValue('roleRef', e.target.value)}>
                            <option value="">(None)</option>
                            {roles.map(r => (
                              <option key={r._id} value={r._id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </>
                )}
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


