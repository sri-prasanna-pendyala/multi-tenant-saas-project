import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '⬡', roles: ['super_admin', 'tenant_admin', 'user'] },
  { path: '/projects', label: 'Projects', icon: '◈', roles: ['super_admin', 'tenant_admin', 'user'] },
  { path: '/users', label: 'Users', icon: '◉', roles: ['super_admin', 'tenant_admin'] },
  { path: '/tenants', label: 'Tenants', icon: '◎', roles: ['super_admin'] },
];

export default function Layout({ children }) {
  const { user, logoutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const roleBadge = { super_admin: 'badge-purple', tenant_admin: 'badge-blue', user: 'badge-gray' };
  const roleLabel = { super_admin: 'Super Admin', tenant_admin: 'Admin', user: 'Member' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 12px',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '8px 12px 28px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--accent)' }}>Tenant</span>Flow
          </div>
          {user?.tenant && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
              {user.tenant.subdomain}.app
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.filter(i => i.roles.includes(user?.role)).map(item => {
            const active = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 4,
                color: active ? 'var(--text)' : 'var(--text2)',
                background: active ? 'var(--surface)' : 'transparent',
                textDecoration: 'none', fontSize: 14, fontWeight: active ? 600 : 400,
                transition: 'all 0.15s ease', borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
              {user?.fullName || user?.full_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{user?.email}</div>
            <span className={`badge ${roleBadge[user?.role]}`}>{roleLabel[user?.role]}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--red)' }}>
            ⏻ Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: '28px 32px', maxWidth: '100%', minHeight: '100vh' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding: 16px !important; }
          aside { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
