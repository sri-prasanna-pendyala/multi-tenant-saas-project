const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// PATCH /api/tasks/:taskId/status
router.patch('/:taskId/status', authenticate, async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  if (!status || !['todo', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Valid status is required (todo, in_progress, completed)' });
  }

  try {
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskResult.rows[0];

    if (req.user.role !== 'super_admin' && task.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at',
      [status, taskId]
    );

    return res.status(200).json({
      success: true,
      data: { id: result.rows[0].id, status: result.rows[0].status, updatedAt: result.rows[0].updated_at },
    });
  } catch (err) {
    console.error('Update task status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update task status' });
  }
});

// PUT /api/tasks/:taskId
router.put('/:taskId', authenticate, async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, priority, assignedTo, dueDate } = req.body;

  try {
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskResult.rows[0];

    if (req.user.role !== 'super_admin' && task.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (assignedTo !== undefined && assignedTo !== null) {
      const assignedUser = await pool.query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2', [assignedTo, task.tenant_id]);
      if (assignedUser.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Assigned user does not belong to this tenant' });
      }
    }

    const updates = []; const params = [];
    if (title !== undefined) { params.push(title); updates.push(`title = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
    if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
    if (priority !== undefined) { params.push(priority); updates.push(`priority = $${params.length}`); }
    if (assignedTo !== undefined) { params.push(assignedTo); updates.push(`assigned_to = $${params.length}`); }
    if (dueDate !== undefined) { params.push(dueDate); updates.push(`due_date = $${params.length}`); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(taskId);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    const t = result.rows[0];

    let assignedToDetails = null;
    if (t.assigned_to) {
      const userResult = await pool.query('SELECT id, full_name, email FROM users WHERE id = $1', [t.assigned_to]);
      if (userResult.rows.length > 0) {
        const u = userResult.rows[0];
        assignedToDetails = { id: u.id, fullName: u.full_name, email: u.email };
      }
    }

    await auditLog(req.user.tenantId, req.user.id, 'UPDATE_TASK', 'task', taskId, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignedTo: assignedToDetails,
        dueDate: t.due_date,
        updatedAt: t.updated_at,
      },
    });
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:taskId (bonus endpoint)
router.delete('/:taskId', authenticate, async (req, res) => {
  const { taskId } = req.params;

  try {
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskResult.rows[0];

    if (req.user.role !== 'super_admin' && task.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.role === 'user') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    await auditLog(req.user.tenantId, req.user.id, 'DELETE_TASK', 'task', taskId, req.ip);

    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

module.exports = router;
