import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTenantUsers, createUser, updateUser, deleteUser } from '../services/api';
import Modal from '../components/common/Modal';

const roleColors = { super_admin: 'badge-purple', tenant_admin: 'badge-blue', user: 'badge-gray' };
const roleLabels = { super_admin: 'Super Admin', tenant_admin: 'Admin', user: 'Member' };

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', role: 'user', isActive: true });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tenantId = user?.tenant?.id;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await getTenantUsers(tenantId, params);
      setUsers(res.data.data.users);
    } catch (e) { setError('Failed to load users'); }
    finally { setLoading(false); }
  }, [tenantId, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditUser(null); setForm({ email: '', fullName: '', password: '', role: 'user', isActive: true }); setFormError(''); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ email: u.email, fullName: u.fullName, password: '', role: u.role, isActive: u.isActive }); setFormError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.fullName.trim()) { setFormError('Full name is required'); return; }
    if (!editUser && !form.email.trim()) { setFormError('Email is required'); return; }
    if (!editUser && form.password.length < 8) { setFormError('Password must be at least 8 characters'); return; }
    setSaving(true); setFormError('');
    try {
      if (editUser) {
        const payload = { fullName: form.fullName, role: form.role, isActive: form.isActive };
        await updateUser(editUser.id, payload);
      } else {
        await createUser(tenantId, { email: form.email, fullName: form.fullName, password: form.password, role: form.role });
      }
      setShowModal(false); load();
    } catch (e) { setFormError(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteUser(deleteId); setDeleteId(null); load(); }
    catch (e) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Team Members</div>
          <div className="page-subtitle">{users.length} member{users.length !== 1 ? 's' : ''} · {user?.tenant?.maxUsers} max on {user?.tenant?.subscriptionPlan} plan</div>
        </div>
        {user?.role === 'tenant_admin' && <button className="btn btn-primary" onClick={openCreate}>+ Add User</button>}
      </div>

      <div className="filter-bar">
        <input className="input search-input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="tenant_admin">Admin</option>
          <option value="user">Member</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /></div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◉</div>
          <div className="empty-state-title">No users found</div>
          <div className="empty-state-text">Add team members to collaborate on projects</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreate}>+ Add User</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                        {u.fullName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                        {u.id === user?.id && <div style={{ fontSize: 11, color: 'var(--text3)' }}>You</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{u.email}</td>
                  <td><span className={`badge ${roleColors[u.role]}`}>{roleLabels[u.role]}</span></td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {user?.role === 'tenant_admin' && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                          {u.id !== user.id && <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(u.id)}>Delete</button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          title={editUser ? 'Edit User' : 'Add Team Member'}
          subtitle={editUser ? 'Update user details and role' : 'Invite a new member to your workspace'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : (editUser ? 'Save Changes' : 'Add Member')}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          {!editUser && (
            <div className="input-group">
              <label className="input-label">Email Address *</label>
              <input type="email" className="input" placeholder="member@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoFocus />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Full Name *</label>
            <input className="input" placeholder="Jane Smith" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
          </div>
          {!editUser && (
            <div className="input-group">
              <label className="input-label">Password *</label>
              <input type="password" className="input" placeholder="Min 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="user">Member</option>
              <option value="tenant_admin">Admin</option>
            </select>
          </div>
          {editUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <label htmlFor="isActive" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>Active account</label>
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="Remove User" onClose={() => setDeleteId(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Remove User</button>
            </>
          }
        >
          <p className="confirm-text">Are you sure you want to remove this user from the workspace? They will lose access immediately.</p>
        </Modal>
      )}
    </div>
  );
}
