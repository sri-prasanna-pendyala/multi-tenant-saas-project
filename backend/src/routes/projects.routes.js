const express = require("express");
const { v4: uuidv4 } = require("uuid");
const auth = require("../middleware/auth");
const tenantGuard = require("../middleware/tenantGuard");
const { pool } = require("../config/db");
const auditLog = require("../utils/auditLogger");

const router = express.Router();

/**
 * CREATE PROJECT
 * POST /api/projects
 */
router.post(
  "/projects",
  auth,
  tenantGuard,
  async (req, res) => {
    const { name, description = "", status = "active" } = req.body;

    const countRes = await pool.query(
      "SELECT COUNT(*) FROM projects WHERE tenant_id=$1",
      [req.tenantId]
    );

    const tenantRes = await pool.query(
      "SELECT max_projects FROM tenants WHERE id=$1",
      [req.tenantId]
    );

    if (parseInt(countRes.rows[0].count) >= tenantRes.rows[0].max_projects) {
      return res.status(403).json({
        success: false,
        message: "Project limit reached"
      });
    }

    const projectId = uuidv4();

    await pool.query(
      `INSERT INTO projects (id, tenant_id, name, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectId, req.tenantId, name, description, status, req.user.userId]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "CREATE_PROJECT",
      entityType: "project",
      entityId: projectId,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: "Project created",
      data: { id: projectId }
    });
  }
);

/**
 * LIST PROJECTS
 * GET /api/projects
 */
router.get(
  "/projects",
  auth,
  tenantGuard,
  async (req, res) => {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.status, p.created_at,
              u.full_name AS created_by
       FROM projects p
       JOIN users u ON u.id = p.created_by
       WHERE p.tenant_id=$1
       ORDER BY p.created_at DESC`,
      [req.tenantId]
    );

    res.json({ success: true, data: result.rows });
  }
);

/**
 * UPDATE PROJECT
 * PUT /api/projects/:projectId
 */
router.put(
  "/projects/:projectId",
  auth,
  tenantGuard,
  async (req, res) => {
    const { name, description, status } = req.body;

    const projectRes = await pool.query(
      "SELECT * FROM projects WHERE id=$1 AND tenant_id=$2",
      [req.params.projectId, req.tenantId]
    );

    if (!projectRes.rows.length) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const project = projectRes.rows[0];

    if (
      req.user.role !== "tenant_admin" &&
      project.created_by !== req.user.userId
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status)
       WHERE id=$4`,
      [name, description, status, project.id]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "UPDATE_PROJECT",
      entityType: "project",
      entityId: project.id,
      ip: req.ip
    });

    res.json({ success: true, message: "Project updated" });
  }
);

/**
 * DELETE PROJECT
 * DELETE /api/projects/:projectId
 */
router.delete(
  "/projects/:projectId",
  auth,
  tenantGuard,
  async (req, res) => {
    const projectRes = await pool.query(
      "SELECT * FROM projects WHERE id=$1 AND tenant_id=$2",
      [req.params.projectId, req.tenantId]
    );

    if (!projectRes.rows.length) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const project = projectRes.rows[0];

    if (
      req.user.role !== "tenant_admin" &&
      project.created_by !== req.user.userId
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query("DELETE FROM projects WHERE id=$1", [project.id]);

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "DELETE_PROJECT",
      entityType: "project",
      entityId: project.id,
      ip: req.ip
    });

    res.json({ success: true, message: "Project deleted" });
  }
);

module.exports = router;
