import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '', tenantSubdomain: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const fillDemo = (email, password, subdomain) => {
    setForm({ email, password, tenantSubdomain: subdomain });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!form.password) { setError('Password is required'); return; }

    setLoading(true);
    try {
      // Build payload — always send subdomain if provided
      const payload = {
        email: form.email.trim(),
        password: form.password,
      };

      // Only add subdomain if user typed one
      const subdomain = form.tenantSubdomain.trim().toLowerCase();
      if (subdomain) {
        payload.tenantSubdomain = subdomain;
      }

      const res = await login(payload);
      const { token, user } = res.data.data;
      loginUser(token, user);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message;
      const status = err.response?.status;

      if (!err.response) {
        setError('Cannot connect to server. Make sure Docker containers are running on port 5000.');
      } else if (status === 401) {
        setError('Wrong email or password. Please check your credentials.');
      } else if (status === 404) {
        setError(`Tenant not found. Check the subdomain spelling (e.g. "demo").`);
      } else if (status === 403) {
        setError('Account or tenant is suspended/inactive.');
      } else if (status === 400) {
        setError(msg || 'Please fill in all required fields.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { label: 'Super Admin', email: 'superadmin@system.com', pw: 'Admin@123', sub: '', hint: 'leave subdomain blank' },
    { label: 'Tenant Admin', email: 'admin@demo.com', pw: 'Demo@123', sub: 'demo', hint: 'subdomain: demo' },
    { label: 'User 1', email: 'user1@demo.com', pw: 'User@123', sub: 'demo', hint: 'subdomain: demo' },
    { label: 'User 2', email: 'user2@demo.com', pw: 'User@123', sub: 'demo', hint: 'subdomain: demo' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 6 }}>
            <span style={{ color: 'var(--accent)' }}>Tenant</span>Flow
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Sign in to your workspace</p>
        </div>

        {/* Main card */}
        <div className="card" style={{ padding: 32 }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input
                name="email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  className="input"
                  placeholder="Your password"
                  value={form.password}
                  onChange={handleChange}
                  style={{ paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                Workspace Subdomain
                <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none', marginLeft: 6, fontSize: 11 }}>
                  (leave blank for Super Admin)
                </span>
              </label>
              <input
                name="tenantSubdomain"
                type="text"
                className="input"
                placeholder="e.g. demo"
                value={form.tenantSubdomain}
                onChange={handleChange}
                autoComplete="off"
              />
              {form.tenantSubdomain && (
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>
                  Workspace: {form.tenantSubdomain.toLowerCase()}.tenantflow.app
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Signing in...</>
                : 'Sign In →'
              }
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
            No account? <Link to="/register">Create your workspace</Link>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="card" style={{ marginTop: 14, padding: 18, background: 'var(--bg2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            🔑 Click to fill demo credentials
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {demoAccounts.map(a => (
              <button
                key={a.label}
                type="button"
                onClick={() => fillDemo(a.email, a.pw, a.sub)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '8px 12px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.email}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                  <div>{a.pw}</div>
                  <div>{a.hint}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
