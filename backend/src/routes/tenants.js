const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// GET /api/tenants - Super admin only
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, subscriptionPlan } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) { params.push(status); whereClause += ` AND t.status = $${params.length}`; }
    if (subscriptionPlan) { params.push(subscriptionPlan); whereClause += ` AND t.subscription_plan = $${params.length}`; }
    const countResult = await pool.query(`SELECT COUNT(*) FROM tenants t ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);
    params.push(parseInt(limit));
    params.push(offset);
    const result = await pool.query(
      `SELECT t.*, (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as total_users, (SELECT COUNT(*) FROM projects p WHERE p.tenant_id = t.id) as total_projects FROM tenants t ${whereClause} ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.status(200).json({
      success: true,
      data: {
        tenants: result.rows.map(t => ({ id: t.id, name: t.name, subdomain: t.subdomain, status: t.status, subscriptionPlan: t.subscription_plan, maxUsers: t.max_users, maxProjects: t.max_projects, totalUsers: parseInt(t.total_users), totalProjects: parseInt(t.total_projects), createdAt: t.created_at })),
        pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalTenants: total, limit: parseInt(limit) },
      },
    });
  } catch (err) { console.error(err); return res.status(500).json({ success: false, message: 'Failed to list tenants' }); }
});

// GET /api/tenants/:tenantId
router.get('/:tenantId', authenticate, async (req, res) => {
  const { tenantId } = req.params;
  if (req.user.role !== 'super_admin' && req.user.tenantId !== tenantId) return res.status(403).json({ success: false, message: 'Access denied' });
  try {
    const result = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const t = result.rows[0];
    const stats = await pool.query(`SELECT (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as total_users, (SELECT COUNT(*) FROM projects WHERE tenant_id = $1) as total_projects, (SELECT COUNT(*) FROM tasks WHERE tenant_id = $1) as total_tasks`, [tenantId]);
    const s = stats.rows[0];
    return res.status(200).json({ success: true, data: { id: t.id, name: t.name, subdomain: t.subdomain, status: t.status, subscriptionPlan: t.subscription_plan, maxUsers: t.max_users, maxProjects: t.max_projects, createdAt: t.created_at, stats: { totalUsers: parseInt(s.total_users), totalProjects: parseInt(s.total_projects), totalTasks: parseInt(s.total_tasks) } } });
  } catch (err) { console.error(err); return res.status(500).json({ success: false, message: 'Failed to get tenant' }); }
});

// PUT /api/tenants/:tenantId
router.put('/:tenantId', authenticate, async (req, res) => {
  const { tenantId } = req.params;
  const { name, status, subscriptionPlan, maxUsers, maxProjects } = req.body;
  if (req.user.role === 'user') return res.status(403).json({ success: false, message: 'Access denied' });
  if (req.user.role === 'tenant_admin' && req.user.tenantId !== tenantId) return res.status(403).json({ success: false, message: 'Access denied' });
  if (req.user.role === 'tenant_admin' && (status || subscriptionPlan || maxUsers || maxProjects)) return res.status(403).json({ success: false, message: 'Insufficient permissions to update these fields' });
  try {
    const existing = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const updates = []; const params = [];
    if (name) { params.push(name); updates.push(`name = $${params.length}`); }
    if (req.user.role === 'super_admin') {
      if (status) { params.push(status); updates.push(`status = $${params.length}`); }
      if (subscriptionPlan) {
        params.push(subscriptionPlan); updates.push(`subscription_plan = $${params.length}`);
        const limits = { free: { users: 5, projects: 3 }, pro: { users: 25, projects: 15 }, enterprise: { users: 100, projects: 50 } };
        if (limits[subscriptionPlan]) { params.push(limits[subscriptionPlan].users); updates.push(`max_users = $${params.length}`); params.push(limits[subscriptionPlan].projects); updates.push(`max_projects = $${params.length}`); }
      }
      if (maxUsers) { params.push(maxUsers); updates.push(`max_users = $${params.length}`); }
      if (maxProjects) { params.push(maxProjects); updates.push(`max_projects = $${params.length}`); }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    updates.push(`updated_at = NOW()`); params.push(tenantId);
    const result = await pool.query(`UPDATE tenants SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    await auditLog(tenantId, req.user.id, 'UPDATE_TENANT', 'tenant', tenantId, req.ip);
    return res.status(200).json({ success: true, message: 'Tenant updated successfully', data: { id: result.rows[0].id, name: result.rows[0].name, updatedAt: result.rows[0].updated_at } });
  } catch (err) { console.error(err); return res.status(500).json({ success: false, message: 'Failed to update tenant' }); }
});

// GET /api/tenants/:tenantId/users
router.get('/:tenantId/users', authenticate, async (req, res) => {
  const { tenantId } = req.params;
  if (req.user.role !== 'super_admin' && req.user.tenantId !== tenantId) return res.status(403).json({ success: false, message: 'Access denied' });
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE tenant_id = $1'; const params = [tenantId];
    if (search) { params.push(`%${search}%`); whereClause += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    if (role) { params.push(role); whereClause += ` AND role = $${params.length}`; }
    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);
    params.push(parseInt(limit)); params.push(offset);
    const result = await pool.query(`SELECT id, email, full_name, role, is_active, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return res.status(200).json({ success: true, data: { users: result.rows.map(u => ({ id: u.id, email: u.email, fullName: u.full_name, role: u.role, isActive: u.is_active, createdAt: u.created_at })), total, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) } } });
  } catch (err) { console.error(err); return res.status(500).json({ success: false, message: 'Failed to list users' }); }
});

// POST /api/tenants/:tenantId/users
router.post('/:tenantId/users', authenticate, async (req, res) => {
  const { tenantId } = req.params;
  if (req.user.role !== 'super_admin' && (req.user.role !== 'tenant_admin' || req.user.tenantId !== tenantId)) return res.status(403).json({ success: false, message: 'Access denied' });
  const { email, password, fullName, role = 'user' } = req.body;
  if (!email || !password || !fullName) return res.status(400).json({ success: false, message: 'Email, password, and full name are required' });
  if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  if (!['user', 'tenant_admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
  try {
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const t = tenant.rows[0];
    const userCount = await pool.query('SELECT COUNT(*) FROM users WHERE tenant_id = $1', [tenantId]);
    if (parseInt(userCount.rows[0].count) >= t.max_users) return res.status(403).json({ success: false, message: 'Subscription limit reached: max users exceeded' });
    const existing = await pool.query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, email]);
    if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'Email already exists in this tenant' });
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const result = await pool.query(`INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`, [userId, tenantId, email, passwordHash, fullName, role]);
    await auditLog(tenantId, req.user.id, 'CREATE_USER', 'user', userId, req.ip);
    const u = result.rows[0];
    return res.status(201).json({ success: true, message: 'User created successfully', data: { id: u.id, email: u.email, fullName: u.full_name, role: u.role, tenantId: u.tenant_id, isActive: u.is_active, createdAt: u.created_at } });
  } catch (err) { console.error(err); return res.status(500).json({ success: false, message: 'Failed to create user' }); }
});

module.exports = router;
