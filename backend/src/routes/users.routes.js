const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const tenantGuard = require("../middleware/tenantGuard");
const { pool } = require("../config/db");
const auditLog = require("../utils/auditLogger");

const router = express.Router();

/**
 * ADD USER
 * POST /api/tenants/:tenantId/users
 */
router.post(
  "/tenants/:tenantId/users",
  auth,
  requireRole("tenant_admin"),
  tenantGuard,
  async (req, res) => {
    if (req.params.tenantId !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Cross-tenant access denied" });
    }

    const { email, password, fullName, role = "user" } = req.body;

    const countRes = await pool.query(
      "SELECT COUNT(*) FROM users WHERE tenant_id=$1",
      [req.tenantId]
    );

    const tenantRes = await pool.query(
      "SELECT max_users FROM tenants WHERE id=$1",
      [req.tenantId]
    );

    if (parseInt(countRes.rows[0].count) >= tenantRes.rows[0].max_users) {
      return res.status(403).json({ success: false, message: "Subscription limit reached" });
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, req.tenantId, email, hash, fullName, role]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "CREATE_USER",
      entityType: "user",
      entityId: userId,
      ip: req.ip
    });

    res.status(201).json({ success: true, message: "User created" });
  }
);
/**
 * LIST USERS
 * GET /api/tenants/:tenantId/users
 */
router.get(
  "/tenants/:tenantId/users",
  auth,
  tenantGuard,
  async (req, res) => {
    if (req.params.tenantId !== req.tenantId && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const users = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM users WHERE tenant_id=$1 ORDER BY created_at DESC`,
      [req.tenantId]
    );

    res.json({ success: true, data: users.rows });
  }
);
/**
 * UPDATE USER
 * PUT /api/users/:userId
 */
router.put(
  "/users/:userId",
  auth,
  tenantGuard,
  async (req, res) => {
    const { fullName, role, isActive } = req.body;

    const userRes = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [req.params.userId]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const target = userRes.rows[0];

    if (req.user.role !== "tenant_admin" && req.user.userId !== target.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           role = COALESCE($2, role),
           is_active = COALESCE($3, is_active)
       WHERE id=$4`,
      [fullName, role, isActive, target.id]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "UPDATE_USER",
      entityType: "user",
      entityId: target.id,
      ip: req.ip
    });

    res.json({ success: true, message: "User updated" });
  }
);
/**
 * DELETE USER
 * DELETE /api/users/:userId
 */
router.delete(
  "/users/:userId",
  auth,
  requireRole("tenant_admin"),
  tenantGuard,
  async (req, res) => {
    if (req.user.userId === req.params.userId) {
      return res.status(403).json({ success: false, message: "Cannot delete yourself" });
    }

    await pool.query("DELETE FROM users WHERE id=$1 AND tenant_id=$2", [
      req.params.userId,
      req.tenantId
    ]);

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "DELETE_USER",
      entityType: "user",
      entityId: req.params.userId,
      ip: req.ip
    });

    res.json({ success: true, message: "User deleted" });
  }
);

/**
 * API 8: ADD USER TO TENANT
 */
router.post(
  "/tenants/:tenantId/users",
  auth,
  tenantGuard,
  async (req, res) => {
    if (req.user.role !== "tenant_admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { email, password, fullName, role = "user" } = req.body;

    try {
      const tenantRes = await pool.query(
        "SELECT max_users FROM tenants WHERE id=$1",
        [req.params.tenantId]
      );

      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE tenant_id=$1",
        [req.params.tenantId]
      );

      if (+countRes.rows[0].count >= tenantRes.rows[0].max_users) {
        return res.status(403).json({
          success: false,
          message: "Subscription limit reached"
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      await pool.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, req.params.tenantId, email, passwordHash, fullName, role]
      );

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: { id: userId, email, fullName, role }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
/**
 * API 9: LIST TENANT USERS
 */
router.get(
  "/tenants/:tenantId/users",
  auth,
  tenantGuard,
  async (req, res) => {
    try {
      const usersRes = await pool.query(
        `SELECT id, email, full_name, role, is_active, created_at
         FROM users
         WHERE tenant_id=$1
         ORDER BY created_at DESC`,
        [req.params.tenantId]
      );

      res.json({
        success: true,
        data: {
          users: usersRes.rows,
          total: usersRes.rows.length
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
/**
 * API 10: UPDATE USER
 */
router.put(
  "/users/:userId",
  auth,
  tenantGuard,
  async (req, res) => {
    const { fullName, role, isActive } = req.body;

    try {
      const userRes = await pool.query(
        "SELECT tenant_id FROM users WHERE id=$1",
        [req.params.userId]
      );

      if (!userRes.rows.length) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Tenant isolation
      if (
        req.user.role !== "super_admin" &&
        userRes.rows[0].tenant_id !== req.tenantId
      ) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Permission check
      if (
        (role !== undefined || isActive !== undefined) &&
        req.user.role !== "tenant_admin"
      ) {
        return res.status(403).json({ success: false, message: "Not authorized" });
      }

      await pool.query(
        `UPDATE users
         SET full_name=COALESCE($1, full_name),
             role=COALESCE($2, role),
             is_active=COALESCE($3, is_active)
         WHERE id=$4`,
        [fullName, role, isActive, req.params.userId]
      );

      res.json({
        success: true,
        message: "User updated successfully"
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
/**
 * API 11: DELETE USER
 */
router.delete(
  "/users/:userId",
  auth,
  tenantGuard,
  async (req, res) => {
    try {
      if (req.user.role !== "tenant_admin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      if (req.params.userId === req.user.userId) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete yourself"
        });
      }

      const userRes = await pool.query(
        "SELECT tenant_id FROM users WHERE id=$1",
        [req.params.userId]
      );

      if (!userRes.rows.length) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (userRes.rows[0].tenant_id !== req.tenantId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Unassign tasks
      await pool.query(
        "UPDATE tasks SET assigned_to=NULL WHERE assigned_to=$1",
        [req.params.userId]
      );

      // Delete user
      await pool.query(
        "DELETE FROM users WHERE id=$1",
        [req.params.userId]
      );

      res.json({ success: true, message: "User deleted successfully" });

    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);


module.exports = router;
