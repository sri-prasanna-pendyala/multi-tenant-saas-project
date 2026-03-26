const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// POST /api/projects
router.post('/', authenticate, async (req, res) => {
  const { name, description, status = 'active' } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Project name is required' });
  }

  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'Super admin cannot create projects directly' });
  }

  try {
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const t = tenant.rows[0];
    const projCount = await pool.query('SELECT COUNT(*) FROM projects WHERE tenant_id = $1', [tenantId]);

    if (parseInt(projCount.rows[0].count) >= t.max_projects) {
      return res.status(403).json({ success: false, message: 'Subscription limit reached: max projects exceeded' });
    }

    const projectId = uuidv4();
    const result = await pool.query(
      `INSERT INTO projects (id, tenant_id, name, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [projectId, tenantId, name, description || null, status, req.user.id]
    );

    await auditLog(tenantId, req.user.id, 'CREATE_PROJECT', 'project', projectId, req.ip);

    const p = result.rows[0];
    return res.status(201).json({
      success: true,
      data: { id: p.id, tenantId: p.tenant_id, name: p.name, description: p.description, status: p.status, createdBy: p.created_by, createdAt: p.created_at },
    });
  } catch (err) {
    console.error('Create project error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create project' });
  }
});

// GET /api/projects
router.get('/', authenticate, async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const tenantId = req.user.tenantId;

  try {
    let whereClause = req.user.role === 'super_admin' ? 'WHERE 1=1' : 'WHERE p.tenant_id = $1';
    const params = req.user.role === 'super_admin' ? [] : [tenantId];

    if (status) { params.push(status); whereClause += ` AND p.status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); whereClause += ` AND p.name ILIKE $${params.length}`; }

    const countResult = await pool.query(`SELECT COUNT(*) FROM projects p ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await pool.query(
      `SELECT p.*, u.full_name as creator_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') as completed_task_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.status(200).json({
      success: true,
      data: {
        projects: result.rows.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          createdBy: { id: p.created_by, fullName: p.creator_name },
          taskCount: parseInt(p.task_count),
          completedTaskCount: parseInt(p.completed_task_count),
          createdAt: p.created_at,
        })),
        total,
        pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) },
      },
    });
  } catch (err) {
    console.error('List projects error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list projects' });
  }
});

// PUT /api/projects/:projectId
router.put('/:projectId', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const { name, description, status } = req.body;

  try {
    const projResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projResult.rows[0];

    if (req.user.role !== 'super_admin' && project.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.role === 'user' && project.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updates = []; const params = [];
    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
    if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(projectId);

    const result = await pool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await auditLog(req.user.tenantId, req.user.id, 'UPDATE_PROJECT', 'project', projectId, req.ip);

    const p = result.rows[0];
    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: { id: p.id, name: p.name, description: p.description, status: p.status, updatedAt: p.updated_at },
    });
  } catch (err) {
    console.error('Update project error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update project' });
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, async (req, res) => {
  const { projectId } = req.params;

  try {
    const projResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projResult.rows[0];

    if (req.user.role !== 'super_admin' && project.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.role === 'user' && project.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await auditLog(req.user.tenantId, req.user.id, 'DELETE_PROJECT', 'project', projectId, req.ip);

    return res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
});

// POST /api/projects/:projectId/tasks
router.post('/:projectId/tasks', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const { title, description, assignedTo, priority = 'medium', dueDate } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: 'Task title is required' });
  }

  try {
    const projResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projResult.rows[0];

    if (req.user.role !== 'super_admin' && project.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (assignedTo) {
      const assignedUser = await pool.query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2', [assignedTo, project.tenant_id]);
      if (assignedUser.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Assigned user does not belong to this tenant' });
      }
    }

    const taskId = uuidv4();
    const result = await pool.query(
      `INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8) RETURNING *`,
      [taskId, projectId, project.tenant_id, title, description || null, priority, assignedTo || null, dueDate || null]
    );

    await auditLog(project.tenant_id, req.user.id, 'CREATE_TASK', 'task', taskId, req.ip);

    const t = result.rows[0];
    return res.status(201).json({
      success: true,
      data: { id: t.id, projectId: t.project_id, tenantId: t.tenant_id, title: t.title, description: t.description, status: t.status, priority: t.priority, assignedTo: t.assigned_to, dueDate: t.due_date, createdAt: t.created_at },
    });
  } catch (err) {
    console.error('Create task error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create task' });
  }
});

// GET /api/projects/:projectId/tasks
router.get('/:projectId/tasks', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const { status, assignedTo, priority, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const projResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projResult.rows[0];

    if (req.user.role !== 'super_admin' && project.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let whereClause = 'WHERE t.project_id = $1';
    const params = [projectId];

    if (status) { params.push(status); whereClause += ` AND t.status = $${params.length}`; }
    if (assignedTo) { params.push(assignedTo); whereClause += ` AND t.assigned_to = $${params.length}`; }
    if (priority) { params.push(priority); whereClause += ` AND t.priority = $${params.length}`; }
    if (search) { params.push(`%${search}%`); whereClause += ` AND t.title ILIKE $${params.length}`; }

    const countResult = await pool.query(`SELECT COUNT(*) FROM tasks t ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);

    const result = await pool.query(
      `SELECT t.*, u.id as user_id, u.full_name as user_name, u.email as user_email
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       ${whereClause}
       ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                t.due_date ASC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.status(200).json({
      success: true,
      data: {
        tasks: result.rows.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assigned_to ? { id: t.user_id, fullName: t.user_name, email: t.user_email } : null,
          dueDate: t.due_date,
          createdAt: t.created_at,
        })),
        total,
        pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) },
      },
    });
  } catch (err) {
    console.error('List tasks error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list tasks' });
  }
});

module.exports = router;
