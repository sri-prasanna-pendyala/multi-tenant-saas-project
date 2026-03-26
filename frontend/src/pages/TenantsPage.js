import React, { useState, useEffect, useCallback } from 'react';
import { getTenants, updateTenant } from '../services/api';
import Modal from '../components/common/Modal';

const planColors = { free: 'badge-gray', pro: 'badge-blue', enterprise: 'badge-purple' };
const statusColors = { active: 'badge-green', suspended: 'badge-red', trial: 'badge-yellow' };

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalTenants: 0 });
  const [editTenant, setEditTenant] = useState(null);
  const [form, setForm] = useState({ name: '', status: '', subscriptionPlan: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.subscriptionPlan = planFilter;
      const res = await getTenants(params);
      setTenants(res.data.data.tenants);
      setPagination(res.data.data.pagination);
    } catch (e) { setError('Failed to load tenants'); }
    finally { setLoading(false); }
  }, [statusFilter, planFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (t) => { setEditTenant(t); setForm({ name: t.name, status: t.status, subscriptionPlan: t.subscriptionPlan }); setFormError(''); };

  const handleSave = async () => {
    setSaving(true); setFormError('');
    try {
      await updateTenant(editTenant.id, form);
      setEditTenant(null); load();
    } catch (e) { setFormError(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">All Tenants</div>
          <div className="page-subtitle">{pagination.totalTenants} total organizations</div>
        </div>
      </div>

      <div className="filter-bar">
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="trial">Trial</option>
        </select>
        <select className="input" value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /></div>
      ) : tenants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◎</div>
          <div className="empty-state-title">No tenants found</div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Subdomain</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Projects</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{t.subdomain}</td>
                    <td><span className={`badge ${planColors[t.subscriptionPlan]}`}>{t.subscriptionPlan}</span></td>
                    <td><span className={`badge ${statusColors[t.status]}`}>{t.status}</span></td>
                    <td style={{ color: 'var(--text2)' }}>{t.totalUsers} / {t.maxUsers}</td>
                    <td style={{ color: 'var(--text2)' }}>{t.totalProjects} / {t.maxProjects}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn ${p === pagination.currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => load(p)}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editTenant && (
        <Modal title="Manage Tenant" subtitle={`${editTenant.name} · ${editTenant.subdomain}`} onClose={() => setEditTenant(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditTenant(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="input-group"><label className="input-label">Organization Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="input-group"><label className="input-label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option><option value="suspended">Suspended</option><option value="trial">Trial</option>
            </select>
          </div>
          <div className="input-group"><label className="input-label">Subscription Plan</label>
            <select className="input" value={form.subscriptionPlan} onChange={e => setForm({ ...form, subscriptionPlan: e.target.value })}>
              <option value="free">Free (5 users, 3 projects)</option>
              <option value="pro">Pro (25 users, 15 projects)</option>
              <option value="enterprise">Enterprise (100 users, 50 projects)</option>
            </select>
          </div>
          <div className="alert alert-info" style={{ marginTop: 0 }}>
            Current: {editTenant.totalUsers} users, {editTenant.totalProjects} projects
          </div>
        </Modal>
      )}
    </div>
  );
}
