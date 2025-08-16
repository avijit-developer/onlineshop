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
  const [roles, setRoles] = useState([]);
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  const authHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
  };

  // Function to refresh vendor user permissions after role updates
  const refreshVendorUserPermissions = async (roleId = null) => {
    try {
      console.log('Starting vendor user permissions refresh...', roleId ? `for role: ${roleId}` : 'for all roles');
      const res = await fetch(`${API_BASE}/api/v1/vendor-users/refresh-permissions`, { 
        method: 'POST', 
        headers: authHeaders(),
        body: JSON.stringify({ roleId })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Vendor user permissions refreshed successfully:', data);
        toast.success(`Updated permissions for ${data.updatedCount || 0} vendor users`);
        
        // Only invalidate tokens for vendor users affected by this role change
        if (data.affectedUserIds && data.affectedUserIds.length > 0) {
          await invalidateSpecificVendorUserTokens(data.affectedUserIds);
        }
      } else {
        const errorData = await res.json();
        console.error('Failed to refresh vendor user permissions:', errorData);
        toast.error('Failed to refresh vendor user permissions');
      }
    } catch (e) {
      console.error('Failed to refresh vendor user permissions:', e);
      toast.error('Failed to refresh vendor user permissions');
    }
  };

  // Function to invalidate specific vendor user tokens
  const invalidateSpecificVendorUserTokens = async (userIds) => {
    try {
      console.log('Invalidating tokens for specific vendor users:', userIds);
      const res = await fetch(`${API_BASE}/api/v1/vendor-users/invalidate-specific-tokens`, { 
        method: 'POST', 
        headers: authHeaders(),
        body: JSON.stringify({ userIds })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Specific vendor user tokens invalidated:', data);
        toast.success(`${data.invalidatedCount || 0} vendor users will need to log in again to get updated permissions`);
      } else {
        const errorData = await res.json();
        console.error('Failed to invalidate specific vendor user tokens:', errorData);
      }
    } catch (e) {
      console.error('Failed to invalidate specific vendor user tokens:', e);
    }
  };

  // Function to refresh current user permissions
  const refreshCurrentUserPermissions = async () => {
    try {
      console.log('Starting current user permissions refresh...');
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh-permissions`, { 
        method: 'POST', 
        headers: authHeaders() 
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Current user permissions refreshed:', data);
        
        // Update the stored user data with new permissions
        const currentUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
        const updatedUser = { ...currentUser, permissions: data.permissions };
        localStorage.setItem('adminUser', JSON.stringify(updatedUser));
        
        // Show a notification instead of reloading
        toast.success('Permissions updated successfully! Dashboard will refresh automatically.');
        
        // Trigger a page reload after a short delay to update the UI with new permissions
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
        console.log('Current user permissions refreshed and page will reload');
      } else {
        const errorData = await res.json();
        console.error('Failed to refresh current user permissions:', errorData);
        toast.error('Failed to refresh current user permissions');
      }
    } catch (e) {
      console.error('Failed to refresh current user permissions:', e);
      toast.error('Failed to refresh current user permissions');
    }
  };

  useEffect(() => {
    loadLists();
  }, [tab]);

  // Ensure roles are loaded when editing vendor users
  useEffect(() => {
    if (showModal && tab === 'vendorUsers' && roles.length === 0) {
      loadLists();
    }
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
    setShowModal(true);
  };

  const openEdit = (item, itemType = null) => {
    setEditingItem(item);
    console.log('Editing item:', item); // Debug log
    console.log('Item type:', itemType || tab); // Debug log
    console.log('Available roles:', roles); // Debug log
    
    // Use setTimeout to ensure form is ready before setting values
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
        
        // Handle multiple vendors - convert single vendor to array format
        let vendorIds = [];
        if (item.vendor) {
          vendorIds = [item.vendor._id || item.vendor];
        } else if (item.vendors) {
          vendorIds = Array.isArray(item.vendors) ? item.vendors.map(v => v._id || v) : [item.vendors];
        }
        setValue('vendors', vendorIds);
        
        // Enhanced role selection logic - check multiple possible data structures
        let roleId = '';
        if (item.roleRef) {
          roleId = typeof item.roleRef === 'object' ? item.roleRef._id : item.roleRef;
        } else if (item.role) {
          roleId = typeof item.role === 'object' ? item.role._id : item.role;
        }
        
        console.log('Role data:', { roleRef: item.roleRef, role: item.role, finalRoleId: roleId }); // Debug log
        console.log('Setting roleRef to:', roleId); // Debug log
        setValue('roleRef', roleId);
        setValue('isActive', item.isActive);
      } else if (currentTab === 'roles') {
        // Handle role editing
        setValue('name', item.name);
        setValue('description', item.description || '');
        setValue('permissions', item.permissions || []);
        console.log('Setting role form values:', { name: item.name, description: item.description, permissions: item.permissions });
      }
    }, 100);
    
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
          console.log('Updating role with data:', { name: data.name, description: data.description, permissions: data.permissions });
          const res = await fetch(`${API_BASE}/api/v1/roles/${editingItem.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: data.name, description: data.description, permissions: data.permissions || [] }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to update role');
          console.log('Role updated successfully:', json);
          toast.success('Role updated');
          
          // After updating a role, refresh vendor users and their permissions
          console.log('Starting permission refresh after role update...');
          await refreshVendorUserPermissions(editingItem.id);
          
          // Verify the role was updated correctly
          console.log('Verifying role update...');
          const verifyRes = await fetch(`${API_BASE}/api/v1/roles/${editingItem.id}`, { headers: authHeaders() });
          const verifyJson = await verifyRes.json();
          if (verifyRes.ok) {
            console.log('Role verification - updated permissions:', verifyJson.data.permissions);
          }
          
          // Also refresh the current user's permissions if they're a vendor user
          await refreshCurrentUserPermissions();
          
          // Refresh vendor users list to get updated role information
          if (tab === 'roles') {
            try {
              const vuRes = await fetch(`${API_BASE}/api/v1/vendor-users`, { headers: authHeaders() });
              const vuJson = await vuRes.json();
              if (vuRes.ok) {
                setVendorUsers(vuJson.data || []);
              }
            } catch (e) {
              console.error('Failed to refresh vendor users after role update:', e);
            }
          }
        } else {
          const res = await fetch(`${API_BASE}/api/v1/roles`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: data.name, description: data.description, permissions: data.permissions || [] }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to create role');
          toast.success('Role created');
        }
      } else {
        if (editingItem) {
          const res = await fetch(`${API_BASE}/api/v1/vendor-users/${editingItem._id || editingItem.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password || undefined, vendors: data.vendors || [], roleRef: data.roleRef || undefined, permissions: data.permissions || [], isActive: !!data.isActive }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || 'Failed to update vendor user');
          toast.success('Vendor user updated');
        } else {
          const res = await fetch(`${API_BASE}/api/v1/vendor-users`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: data.name, email: data.email, password: data.password, vendors: data.vendors || [], roleRef: data.roleRef || undefined, permissions: data.permissions || [], isActive: !!data.isActive }) });
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
        
        // After deleting a role, refresh vendor users and their permissions
        await refreshVendorUserPermissions();
        
        // Also refresh the current user's permissions if they're a vendor user
        await refreshCurrentUserPermissions();
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
                          {['vendor.view','vendor.add','vendor.edit','vendor.delete'].map(p => (
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
                                  {...register('vendors')} 
                                /> 
                                {v.name}
                              </label>
                            ))}
                          </div>
                          {errors.vendors && <span className="error-message">{errors.vendors.message}</span>}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Role</label>
                          <select 
                            className="form-control" 
                            {...register('roleRef')}
                            onChange={(e) => {
                              console.log('Role select changed to:', e.target.value);
                              setValue('roleRef', e.target.value);
                            }}
                          >
                            <option value="">(None)</option>
                            {roles.map(r => (
                              <option key={r._id} value={r._id}>
                                {r.name} (ID: {r._id})
                              </option>
                            ))}
                          </select>
                          <small className="form-text text-muted">
                            Available roles: {roles.length} | Selected: {editingItem?.roleRef?._id || editingItem?.roleRef || editingItem?.role?._id || editingItem?.role || 'None'}
                          </small>
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