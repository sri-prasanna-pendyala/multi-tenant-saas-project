import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerTenant } from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ tenantName: '', subdomain: '', adminEmail: '', adminFullName: '', adminPassword: '', confirmPassword: '', terms: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [apiError, setApiError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if (name === 'subdomain') val = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setForm({ ...form, [name]: val });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const validate = () => {
    const e = {};
    if (!form.tenantName.trim()) e.tenantName = 'Organization name is required';
    if (!form.subdomain || form.subdomain.length < 3) e.subdomain = 'Subdomain must be at least 3 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) e.adminEmail = 'Valid email is required';
    if (!form.adminFullName.trim()) e.adminFullName = 'Full name is required';
    if (form.adminPassword.length < 8) e.adminPassword = 'Password must be at least 8 characters';
    if (form.adminPassword !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!form.terms) e.terms = 'You must agree to terms';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true); setApiError('');
    try {
      await registerTenant({ tenantName: form.tenantName, subdomain: form.subdomain, adminEmail: form.adminEmail, adminPassword: form.adminPassword, adminFullName: form.adminFullName });
      setSuccess(`Workspace "${form.subdomain}" created! Redirecting to login...`);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ name, label, type = 'text', placeholder, hint }) => (
    <div className="input-group">
      <label className="input-label">{label}</label>
      {type === 'password' ? (
        <div style={{ position: 'relative' }}>
          <input name={name} type={showPw ? 'text' : 'password'} className={`input${errors[name] ? ' input-error' : ''}`} placeholder={placeholder} value={form[name]} onChange={handleChange} style={{ paddingRight: 44 }} />
          <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>{showPw ? '🙈' : '👁'}</button>
        </div>
      ) : (
        <input name={name} type={type} className={`input${errors[name] ? ' input-error' : ''}`} placeholder={placeholder} value={form[name]} onChange={handleChange} />
      )}
      {hint && !errors[name] && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{hint}</span>}
      {errors[name] && <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ {errors[name]}</span>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)' }}>Tenant</span>Flow
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Create your organization workspace</p>
        </div>
        <div className="card" style={{ padding: 32 }}>
          {apiError && <div className="alert alert-error">{apiError}</div>}
          {success && <div className="alert alert-success">✓ {success}</div>}
          {!success && (
            <form onSubmit={handleSubmit}>
              <Field name="tenantName" label="Organization Name" placeholder="Acme Inc." />
              <Field name="subdomain" label="Workspace Subdomain" placeholder="acme"
                hint={form.subdomain ? `Preview: ${form.subdomain}.tenantflow.app` : 'Only lowercase letters, numbers, hyphens'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field name="adminEmail" label="Admin Email" type="email" placeholder="admin@acme.com" />
                <Field name="adminFullName" label="Your Full Name" placeholder="Jane Smith" />
              </div>
              <Field name="adminPassword" label="Password" type="password" placeholder="Min 8 characters" />
              <Field name="confirmPassword" label="Confirm Password" type="password" placeholder="Repeat password" />
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                  <input type="checkbox" name="terms" checked={form.terms} onChange={handleChange} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  I agree to the Terms of Service and Privacy Policy
                </label>
                {errors.terms && <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'block' }}>⚠ {errors.terms}</span>}
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Creating workspace...</> : 'Create Workspace →'}
              </button>
            </form>
          )}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
            Already have a workspace? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
