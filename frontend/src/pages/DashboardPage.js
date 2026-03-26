import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjects, getProjectTasks } from '../services/api';

const statusColor = { active: 'badge-green', archived: 'badge-gray', completed: 'badge-blue' };
const priorityColor = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, tasks: 0, completed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const projRes = await getProjects({ limit: 100 });
        const projs = projRes.data.data.projects;
        setProjects(projs.slice(0, 5));

        let allTasks = [], completedCount = 0;
        for (const p of projs.slice(0, 10)) {
          try {
            const taskRes = await getProjectTasks(p.id, { limit: 100 });
            const tasks = taskRes.data.data.tasks;
            allTasks.push(...tasks.map(t => ({ ...t, projectName: p.name, projectId: p.id })));
            completedCount += tasks.filter(t => t.status === 'completed').length;
          } catch {}
        }

        const myT = user ? allTasks.filter(t => t.assignedTo?.id === user.id) : allTasks.slice(0, 10);
        setMyTasks(myT.slice(0, 8));
        setStats({
          total: projs.length,
          tasks: allTasks.length,
          completed: completedCount,
          pending: allTasks.filter(t => t.status !== 'completed').length,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  const planColor = { free: 'badge-gray', pro: 'badge-blue', enterprise: 'badge-purple' };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Good morning, {(user?.fullName || user?.full_name || '').split(' ')[0]} 👋</div>
          <div className="page-subtitle">
            {user?.tenant ? (
              <>{user.tenant.name} · <span className={`badge ${planColor[user.tenant.subscriptionPlan]}`}>{user.tenant.subscriptionPlan}</span></>
            ) : 'System Administrator — all tenants'}
          </div>
        </div>
        <Link to="/projects" className="btn btn-primary">+ New Project</Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { icon: '◈', value: stats.total, label: 'Total Projects', color: 'var(--accent)' },
          { icon: '◇', value: stats.tasks, label: 'Total Tasks', color: 'var(--purple)' },
          { icon: '✓', value: stats.completed, label: 'Completed', color: 'var(--green)' },
          { icon: '⏱', value: stats.pending, label: 'In Progress', color: 'var(--yellow)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ color: s.color }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Subscription info */}
      {user?.tenant && (
        <div className="card" style={{ marginBottom: 28, padding: '16px 20px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Plan Limits</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              <strong style={{ color: 'var(--text)' }}>{stats.total}</strong> / {user.tenant.maxProjects} projects &nbsp;·&nbsp;
              <strong style={{ color: 'var(--text)' }}>{user.tenant.maxUsers}</strong> max users
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Workspace</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{user.tenant.subdomain}.tenantflow.app</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent Projects */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Projects</h2>
            <Link to="/projects" style={{ fontSize: 12, color: 'var(--accent)' }}>View all →</Link>
          </div>
          {projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>◈</div>
              No projects yet. <Link to="/projects">Create one!</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projects.map(p => (
                <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: 16, cursor: 'pointer', transition: 'border-color 0.15s', ':hover': { borderColor: 'var(--border2)' } }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{p.name}</div>
                      <span className={`badge ${statusColor[p.status]}`}>{p.status}</span>
                    </div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {p.taskCount} tasks · {p.completedTaskCount} completed
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Tasks */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{user?.role === 'user' ? 'My Tasks' : 'All Tasks'}</h2>
          </div>
          {myTasks.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>◇</div>
              No tasks assigned yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myTasks.map(t => (
                <Link key={t.id} to={`/projects/${t.projectId}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{t.title}</div>
                      <span className={`badge ${priorityColor[t.priority]}`}>{t.priority}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${t.status === 'completed' ? 'badge-green' : t.status === 'in_progress' ? 'badge-blue' : 'badge-gray'}`}>{t.status.replace('_', ' ')}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.projectName}</span>
                      {t.dueDate && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>Due {new Date(t.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
