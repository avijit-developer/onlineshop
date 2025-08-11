import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import './Customers.css';

const AdminUsers = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/data.json');
      const data = await response.json();
      setAdmins(data.users.admins);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load admin users data');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (editingAdmin) {
        // Update existing admin
        setAdmins(prev => prev.map(admin =>
          admin.id === editingAdmin.id ? { ...admin, ...data } : admin
        ));
        toast.success('Admin user updated successfully');
      } else {
        // Add new admin
        const newAdmin = {
          id: Date.now(),
          ...data,
          status: 'active',
          createdAt: new Date().toISOString().split('T')[0]
        };
        setAdmins(prev => [...prev, newAdmin]);
        toast.success('Admin user created successfully');
      }
      
      handleCloseModal();
    } catch (error) {
      toast.error('Failed to save admin user');
    }
  };

  const handleEdit = (admin) => {
    setEditingAdmin(admin);
    setValue('name', admin.name);
    setValue('email', admin.email);
    setValue('role', admin.role);
    setValue('permissions', admin.permissions);
    setShowModal(true);
  };

  const handleDelete = (admin) => {
    setAdminToDelete(admin);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setAdmins(prev => prev.filter(admin => admin.id !== adminToDelete.id));
      toast.success('Admin user deleted successfully');
      setShowDeleteModal(false);
      setAdminToDelete(null);
    } catch (error) {
      toast.error('Failed to delete admin user');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAdmin(null);
    reset();
  };

  const handleStatusChange = async (adminId, newStatus) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setAdmins(prev => prev.map(admin =>
        admin.id === adminId ? { ...admin, status: newStatus } : admin
      ));
      toast.success(`Admin user ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      toast.error('Failed to update admin status');
    }
  };

  if (loading) {
    return <div className="loading">Loading admin users...</div>;
  }

  return (
    <div className="customers">
      <div className="page-header">
        <h2>Admin Users Management</h2>
        <p>Manage admin users and their permissions</p>
      </div>

      <div className="d-flex justify-between align-center mb-2">
        <div></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Add Admin User
        </button>
      </div>

      {/* Admin Users Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => (
                <tr key={admin.id}>
                  <td>
                    <div className="customer-info">
                      <strong>{admin.name}</strong>
                      <span>ID: {admin.id}</span>
                    </div>
                  </td>
                  <td>{admin.email}</td>
                  <td>
                    <span className={`badge badge-${admin.role === 'Admin' ? 'primary' : 'info'}`}>
                      {admin.role}
                    </span>
                  </td>
                  <td>
                    <div className="permissions">
                      {admin.permissions.includes('all') ? (
                        <span className="badge badge-success">All Permissions</span>
                      ) : (
                        admin.permissions.map(permission => (
                          <span key={permission} className="badge badge-secondary">
                            {permission.replace('_', ' ')}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${admin.status === 'active' ? 'success' : 'secondary'}`}>
                      {admin.status}
                    </span>
                  </td>
                  <td>{new Date(admin.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleEdit(admin)}
                      >
                        Edit
                      </button>
                      <button
                        className={`btn btn-sm ${admin.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => handleStatusChange(admin.id, admin.status === 'active' ? 'inactive' : 'active')}
                      >
                        {admin.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(admin)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Admin Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingAdmin ? 'Edit Admin User' : 'Add Admin User'}
              </h3>
              <button className="modal-close" onClick={handleCloseModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'error' : ''}`}
                    placeholder="Enter admin name"
                    {...register('name', {
                      required: 'Name is required',
                      minLength: {
                        value: 2,
                        message: 'Name must be at least 2 characters'
                      }
                    })}
                  />
                  {errors.name && <span className="error-message">{errors.name.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'error' : ''}`}
                    placeholder="Enter email address"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                  />
                  {errors.email && <span className="error-message">{errors.email.message}</span>}
                </div>

                {!editingAdmin && (
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className={`form-control ${errors.password ? 'error' : ''}`}
                      placeholder="Enter password"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters'
                        }
                      })}
                    />
                    {errors.password && <span className="error-message">{errors.password.message}</span>}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className={`form-control ${errors.role ? 'error' : ''}`}
                    {...register('role', {
                      required: 'Role is required'
                    })}
                  >
                    <option value="">Select Role</option>
                    <option value="Admin">Admin</option>
                    <option value="Vendor Owner">Vendor Owner</option>
                  </select>
                  {errors.role && <span className="error-message">{errors.role.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Permissions</label>
                  <div className="permissions-checkboxes">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        value="all"
                        {...register('permissions')}
                      />
                      All Permissions
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        value="vendor_management"
                        {...register('permissions')}
                      />
                      Vendor Management
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        value="product_management"
                        {...register('permissions')}
                      />
                      Product Management
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        value="order_management"
                        {...register('permissions')}
                      />
                      Order Management
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        value="customer_management"
                        {...register('permissions')}
                      />
                      Customer Management
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAdmin ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && adminToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Delete</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete admin user <strong>{adminToDelete.name}</strong>?</p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers; 