import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects, updateProject, deleteProject, getProjectTasks, createTask, updateTask, updateTaskStatus, deleteTask, getTenantUsers } from '../services/api';
import Modal from '../components/common/Modal';

const statusColors = { active: 'badge-green', archived: 'badge-gray', completed: 'badge-blue' };
const priorityColors = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
const taskStatusColors = { todo: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green' };

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchTask, setSearchTask] = useState('');
  const [showEditProject, setShowEditProject] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', status: 'active' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '', status: 'todo' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const res = await getProjects({ limit: 100 });
      const p = res.data.data.projects.find(p => p.id === projectId);
      if (!p) { navigate('/projects'); return; }
      setProject(p);
      setProjectForm({ name: p.name, description: p.description || '', status: p.status });
    } catch { navigate('/projects'); }
  }, [projectId, navigate]);

  const loadTasks = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (searchTask) params.search = searchTask;
      const res = await getProjectTasks(projectId, params);
      setTasks(res.data.data.tasks);
    } catch (e) { console.error(e); }
  }, [projectId, statusFilter, priorityFilter, searchTask]);

  const loadUsers = useCallback(async () => {
    if (!user?.tenant?.id || user?.role === 'super_admin') return;
    try {
      const res = await getTenantUsers(user.tenant.id, { limit: 100 });
      setUsers(res.data.data.users);
    } catch {}
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProject(), loadTasks(), loadUsers()]);
      setLoading(false);
    };
    init();
  }, [loadProject, loadTasks, loadUsers]);

  const handleUpdateProject = async () => {
    if (!projectForm.name.trim()) { setFormError('Name required'); return; }
    setSaving(true); setFormError('');
    try { await updateProject(projectId, projectForm); await loadProject(); setShowEditProject(false); }
    catch (e) { setFormError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteProject = async () => {
    try { await deleteProject(projectId); navigate('/projects'); }
    catch (e) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  const openCreateTask = () => { setEditTask(null); setTaskForm({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '', status: 'todo' }); setFormError(''); setShowTaskModal(true); };
  const openEditTask = (t) => { setEditTask(t); setTaskForm({ title: t.title, description: t.description || '', priority: t.priority, assignedTo: t.assignedTo?.id || '', dueDate: t.dueDate ? t.dueDate.split('T')[0] : '', status: t.status }); setFormError(''); setShowTaskModal(true); };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) { setFormError('Title required'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = { title: taskForm.title, description: taskForm.description || null, priority: taskForm.priority, assignedTo: taskForm.assignedTo || null, dueDate: taskForm.dueDate || null };
      if (editTask) { await updateTask(editTask.id, { ...payload, status: taskForm.status }); }
      else { await createTask(projectId, payload); }
      setShowTaskModal(false); loadTasks();
    } catch (e) { setFormError(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (taskId, status) => {
    try { await updateTaskStatus(taskId, status); loadTasks(); }
    catch (e) { alert('Failed to update status'); }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    try { await deleteTask(deleteTaskId); setDeleteTaskId(null); loadTasks(); }
    catch (e) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  const canManage = project && (user?.role === 'super_admin' || user?.role === 'tenant_admin' || project.createdBy?.id === user?.id);

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;
  if (!project) return null;

  const grouped = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        <Link to="/projects" style={{ color: 'var(--text3)' }}>Projects</Link> / {project.name}
      </div>

      {/* Project Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</h1>
              <span className={`badge ${statusColors[project.status]}`}>{project.status}</span>
            </div>
            {project.description && <p style={{ color: 'var(--text2)', fontSize: 14 }}>{project.description}</p>}
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
              Created by {project.createdBy?.fullName} · {project.taskCount} tasks · {project.completedTaskCount} completed
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setShowEditProject(true); setFormError(''); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => setDeleteProjectConfirm(true)}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Tasks header */}
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Tasks</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{tasks.length} total tasks</div>
        </div>
        <button className="btn btn-primary" onClick={openCreateTask}>+ Add Task</button>
      </div>

      {/* Task Filters */}
      <div className="filter-bar" style={{ marginBottom: 24 }}>
        <input className="input search-input" placeholder="Search tasks..." value={searchTask} onChange={e => setSearchTask(e.target.value)} />
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select className="input" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Kanban-style columns */}
      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No tasks yet</div>
          <div className="empty-state-text">Add your first task to start tracking work</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreateTask}>+ Add Task</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[['todo', 'To Do', '○'], ['in_progress', 'In Progress', '◑'], ['completed', 'Completed', '●']].map(([status, label, icon]) => (
            <div key={status}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', background: 'var(--surface)', borderRadius: 20, padding: '2px 8px' }}>{grouped[status].length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grouped[status].map(t => (
                  <div key={t.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1, paddingRight: 8 }}>{t.title}</div>
                      <span className={`badge ${priorityColors[t.priority]}`}>{t.priority}</span>
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.description}</div>}
                    {t.assignedTo && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                        👤 {t.assignedTo.fullName}
                      </div>
                    )}
                    {t.dueDate && (
                      <div style={{ fontSize: 11, color: new Date(t.dueDate) < new Date() ? 'var(--red)' : 'var(--text3)', marginBottom: 8 }}>
                        📅 Due {new Date(t.dueDate).toLocaleDateString()}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <select
                        className="input" style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                        value={t.status} onChange={e => handleStatusChange(t.id, e.target.value)}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditTask(t)}>Edit</button>
                      {canManage && <button className="btn btn-danger btn-sm" onClick={() => setDeleteTaskId(t.id)}>×</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProject && (
        <Modal title="Edit Project" onClose={() => setShowEditProject(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowEditProject(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateProject} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="input-group"><label className="input-label">Project Name</label><input className="input" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} /></div>
          <div className="input-group"><label className="input-label">Description</label><textarea className="input" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} rows={3} /></div>
          <div className="input-group"><label className="input-label">Status</label>
            <select className="input" value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}>
              <option value="active">Active</option><option value="archived">Archived</option><option value="completed">Completed</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <Modal title={editTask ? 'Edit Task' : 'Add Task'} onClose={() => setShowTaskModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTask} disabled={saving}>
                {saving ? 'Saving...' : (editTask ? 'Save Changes' : 'Add Task')}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="input-group"><label className="input-label">Title *</label><input className="input" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} autoFocus /></div>
          <div className="input-group"><label className="input-label">Description</label><textarea className="input" placeholder="Optional details..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group"><label className="input-label">Priority</label>
              <select className="input" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            {editTask && (
              <div className="input-group"><label className="input-label">Status</label>
                <select className="input" value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                  <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                </select>
              </div>
            )}
          </div>
          {users.length > 0 && (
            <div className="input-group"><label className="input-label">Assign To</label>
              <select className="input" value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
              </select>
            </div>
          )}
          <div className="input-group"><label className="input-label">Due Date</label><input type="date" className="input" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
        </Modal>
      )}

      {/* Delete Project Confirm */}
      {deleteProjectConfirm && (
        <Modal title="Delete Project" onClose={() => setDeleteProjectConfirm(false)}
          footer={<><button className="btn btn-secondary" onClick={() => setDeleteProjectConfirm(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDeleteProject}>Delete</button></>}
        >
          <p className="confirm-text">Delete "<strong>{project.name}</strong>"? All tasks will be permanently deleted.</p>
        </Modal>
      )}

      {/* Delete Task Confirm */}
      {deleteTaskId && (
        <Modal title="Delete Task" onClose={() => setDeleteTaskId(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setDeleteTaskId(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDeleteTask}>Delete</button></>}
        >
          <p className="confirm-text">Are you sure you want to delete this task?</p>
        </Modal>
      )}
    </div>
  );
}
