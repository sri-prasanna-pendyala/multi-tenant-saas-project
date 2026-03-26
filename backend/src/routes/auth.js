const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// POST /api/auth/register-tenant
router.post('/register-tenant', async (req, res) => {
  const { tenantName, subdomain, adminEmail, adminPassword, adminFullName } = req.body;

  if (!tenantName || !subdomain || !adminEmail || !adminPassword || !adminFullName) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain) || subdomain.length < 3 || subdomain.length > 63) {
    return res.status(400).json({ success: false, message: 'Invalid subdomain format (lowercase letters, numbers, hyphens only, min 3 chars)' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingTenant = await client.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
    if (existingTenant.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Subdomain already exists' });
    }

    const tenantId = uuidv4();
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query(
      `INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects)
       VALUES ($1, $2, $3, 'active', 'free', 5, 3)`,
      [tenantId, tenantName, subdomain]
    );

    const existingEmail = await client.query(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [tenantId, adminEmail]
    );
    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'tenant_admin', true)`,
      [adminId, tenantId, adminEmail, passwordHash, adminFullName]
    );

    await client.query('COMMIT');
    await auditLog(tenantId, adminId, 'CREATE_TENANT', 'tenant', tenantId);

    return res.status(201).json({
      success: true,
      message: 'Tenant registered successfully',
      data: {
        tenantId,
        subdomain,
        adminUser: { id: adminId, email: adminEmail, fullName: adminFullName, role: 'tenant_admin' },
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register tenant error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, tenantSubdomain, tenantId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    let user = null;

    // --- STEP 1: Try super admin login first (no subdomain required) ---
    const superAdminResult = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND role = 'super_admin' AND tenant_id IS NULL`,
      [email]
    );
    if (superAdminResult.rows.length > 0) {
      const superAdmin = superAdminResult.rows[0];
      if (!superAdmin.is_active) {
        return res.status(403).json({ success: false, message: 'Account is inactive' });
      }
      const match = await bcrypt.compare(password, superAdmin.password_hash);
      if (match) {
        user = superAdmin;
      } else if (!tenantSubdomain && !tenantId) {
        // They tried to log in as super admin but password is wrong
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    // --- STEP 2: If not super admin, try tenant user login ---
    if (!user) {
      if (!tenantSubdomain && !tenantId) {
        // No subdomain provided and not a super admin
        return res.status(400).json({ success: false, message: 'Tenant subdomain is required for non-admin users' });
      }

      let tenant;
      if (tenantSubdomain) {
        const tenantResult = await pool.query(
          'SELECT * FROM tenants WHERE subdomain = $1',
          [tenantSubdomain.toLowerCase().trim()]
        );
        if (tenantResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: `Tenant "${tenantSubdomain}" not found` });
        }
        tenant = tenantResult.rows[0];
      } else {
        const tenantResult = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        if (tenantResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Tenant not found' });
        }
        tenant = tenantResult.rows[0];
      }

      if (tenant.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Tenant account is suspended' });
      }

      const userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND tenant_id = $2',
        [email, tenant.id]
      );
      if (userResult.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      user = userResult.rows[0];
      if (!user.is_active) {
        return res.status(403).json({ success: false, message: 'Account is inactive' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    // --- STEP 3: Generate token and return ---
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key_for_saas_app_2024_min32chars',
      { expiresIn: '24h' }
    );

    await auditLog(user.tenant_id, user.id, 'LOGIN', 'user', user.id, req.ip);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          tenantId: user.tenant_id,
        },
        token,
        expiresIn: 86400,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.tenant_id,
              t.id as t_id, t.name as t_name, t.subdomain as t_subdomain,
              t.subscription_plan, t.max_users, t.max_projects
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const u = userResult.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        isActive: u.is_active,
        tenant: u.tenant_id ? {
          id: u.t_id,
          name: u.t_name,
          subdomain: u.t_subdomain,
          subscriptionPlan: u.subscription_plan,
          maxUsers: u.max_users,
          maxProjects: u.max_projects,
        } : null,
      },
    });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await auditLog(req.user.tenantId, req.user.id, 'LOGOUT', 'user', req.user.id, req.ip);
  } catch {}
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
