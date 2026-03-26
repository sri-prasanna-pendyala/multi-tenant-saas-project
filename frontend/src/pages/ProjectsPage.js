import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects, createProject, updateProject, deleteProject } from '../services/api';
import Modal from '../components/common/Modal';

const statusColors = { active: 'badge-green', archived: 'badge-gray', completed: 'badge-blue' };

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', status: 'active' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await getProjects(params);
      setProjects(res.data.data.projects);
    } catch (e) { setError('Failed to load projects'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditProject(null); setForm({ name: '', description: '', status: 'active' }); setFormError(''); setShowModal(true); };
  const openEdit = (p) => { setEditProject(p); setForm({ name: p.name, description: p.description || '', status: p.status }); setFormError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Project name is required'); return; }
    setSaving(true); setFormError('');
    try {
      if (editProject) { await updateProject(editProject.id, form); }
      else { await createProject(form); }
      setShowModal(false); load();
    } catch (e) { setFormError(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteProject(deleteId); setDeleteId(null); load(); }
    catch (e) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  const canManage = (p) => user?.role === 'super_admin' || user?.role === 'tenant_admin' || p.createdBy?.id === user?.id;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
        </div>
        {user?.role !== 'super_admin' && <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>}
      </div>

      <div className="filter-bar">
        <input className="input search-input" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◈</div>
          <div className="empty-state-title">No projects found</div>
          <div className="empty-state-text">Create your first project to get started</div>
          {user?.role !== 'super_admin' && <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreate}>+ New Project</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Link to={`/projects/${p.id}`} style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', textDecoration: 'none' }}>
                  {p.name}
                </Link>
                <span className={`badge ${statusColors[p.status]}`}>{p.status}</span>
              </div>
              {p.description && <div style={{ fontSize: 13, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</div>}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)' }}>
                <span>📋 {p.taskCount} tasks</span>
                <span>✓ {p.completedTaskCount} done</span>
                <span style={{ marginLeft: 'auto' }}>by {p.createdBy?.fullName}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <Link to={`/projects/${p.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>View</Link>
                {canManage(p) && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(p.id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          title={editProject ? 'Edit Project' : 'Create New Project'}
          subtitle={editProject ? 'Update project details' : 'Set up a new project for your team'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Saving...</> : (editProject ? 'Save Changes' : 'Create Project')}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="input-group">
            <label className="input-label">Project Name *</label>
            <input className="input" placeholder="My Awesome Project" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" placeholder="Describe the project goals..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="input-group">
            <label className="input-label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="Delete Project" onClose={() => setDeleteId(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete Project</button>
            </>
          }
        >
          <p className="confirm-text">Are you sure you want to delete this project? All tasks will be permanently deleted. This action cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
