const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// PUT /api/users/:userId
router.put('/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  const { fullName, role, isActive } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Verify same tenant
    if (req.user.role !== 'super_admin' && targetUser.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Users can only update their own fullName
    if (req.user.role === 'user' && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only tenant_admin can update role and isActive
    if (req.user.role === 'user' && (role !== undefined || isActive !== undefined)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const updates = [];
    const params = [];

    if (fullName) { params.push(fullName); updates.push(`full_name = $${params.length}`); }
    if (req.user.role !== 'user') {
      if (role !== undefined) { params.push(role); updates.push(`role = $${params.length}`); }
      if (isActive !== undefined) { params.push(isActive); updates.push(`is_active = $${params.length}`); }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, full_name, role, is_active, updated_at`,
      params
    );

    await auditLog(req.user.tenantId, req.user.id, 'UPDATE_USER', 'user', userId, req.ip);

    const u = result.rows[0];
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { id: u.id, fullName: u.full_name, role: u.role, isActive: u.is_active, updatedAt: u.updated_at },
    });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// DELETE /api/users/:userId
router.delete('/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'super_admin' && req.user.role !== 'tenant_admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (req.user.id === userId) {
    return res.status(403).json({ success: false, message: 'Cannot delete yourself' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    if (req.user.role !== 'super_admin' && targetUser.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Unassign tasks before deletion
    await pool.query('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = $1', [userId]);

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    await auditLog(req.user.tenantId, req.user.id, 'DELETE_USER', 'user', userId, req.ip);

    return res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

module.exports = router;
