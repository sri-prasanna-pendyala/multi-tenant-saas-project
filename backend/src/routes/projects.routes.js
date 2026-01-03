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
router.post("/", auth, tenantGuard, async (req, res) => {
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
});

/**
 * API 13: LIST PROJECTS WITH STATS
 */
router.get(
  "/projects",
  auth,
  tenantGuard,
  async (req, res) => {
    try {
      const { status, search, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const filters = [];
      const values = [req.tenantId];

      if (status) {
        values.push(status);
        filters.push(`p.status = $${values.length}`);
      }

      if (search) {
        values.push(`%${search}%`);
        filters.push(`p.name ILIKE $${values.length}`);
      }

      const whereClause =
        filters.length > 0 ? "AND " + filters.join(" AND ") : "";

      const projectsQuery = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p.status,
          p.created_at,
          u.id AS creator_id,
          u.full_name AS creator_name,
          COUNT(t.id) AS task_count,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS completed_task_count
        FROM projects p
        JOIN users u ON u.id = p.created_by
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.tenant_id = $1
        ${whereClause}
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `;

      const result = await pool.query(projectsQuery, [
        ...values,
        limit,
        offset
      ]);

      const countRes = await pool.query(
        "SELECT COUNT(*) FROM projects WHERE tenant_id=$1",
        [req.tenantId]
      );

      res.json({
        success: true,
        data: {
          projects: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            createdAt: p.created_at,
            createdBy: {
              id: p.creator_id,
              fullName: p.creator_name
            },
            taskCount: Number(p.task_count),
            completedTaskCount: Number(p.completed_task_count)
          })),
          total: Number(countRes.rows[0].count),
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(countRes.rows[0].count / limit),
            limit: Number(limit)
          }
        }
      });

    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);


/**
 * GET SINGLE PROJECT
 * GET /api/projects/:projectId
 */
router.get("/:projectId", auth, tenantGuard, async (req, res) => {
  const projectRes = await pool.query(
    `SELECT p.id, p.name, p.description, p.status, p.created_at,
            u.full_name AS created_by
     FROM projects p
     JOIN users u ON u.id = p.created_by
     WHERE p.id=$1 AND p.tenant_id=$2`,
    [req.params.projectId, req.tenantId]
  );

  if (!projectRes.rows.length) {
    return res.status(404).json({
      success: false,
      message: "Project not found"
    });
  }

  res.json({ success: true, data: projectRes.rows[0] });
});

/**
 * API 14: UPDATE PROJECT
 */
router.put(
  "/projects/:projectId",
  auth,
  tenantGuard,
  async (req, res) => {
    try {
      const { name, description, status } = req.body;

      const projectRes = await pool.query(
        "SELECT * FROM projects WHERE id=$1 AND tenant_id=$2",
        [req.params.projectId, req.tenantId]
      );

      if (!projectRes.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Project not found"
        });
      }

      const project = projectRes.rows[0];

      // 🔐 AUTH CHECK
      if (
        req.user.role !== "tenant_admin" &&
        project.created_by !== req.user.userId
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden"
        });
      }

      await pool.query(
        `
        UPDATE projects
        SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          updated_at = NOW()
        WHERE id = $4
        `,
        [name, description, status, project.id]
      );

      // 🧾 AUDIT LOG
      await auditLog({
        tenantId: req.tenantId,
        userId: req.user.userId,
        action: "UPDATE_PROJECT",
        entityType: "project",
        entityId: project.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Project updated successfully",
        data: {
          id: project.id,
          name: name ?? project.name,
          description: description ?? project.description,
          status: status ?? project.status
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * API 15: DELETE PROJECT
 */
router.delete(
  "/projects/:projectId",
  auth,
  tenantGuard,
  async (req, res) => {
    try {
      const projectRes = await pool.query(
        "SELECT * FROM projects WHERE id=$1 AND tenant_id=$2",
        [req.params.projectId, req.tenantId]
      );

      if (!projectRes.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Project not found"
        });
      }

      const project = projectRes.rows[0];

      // 🔐 AUTH CHECK
      if (
        req.user.role !== "tenant_admin" &&
        project.created_by !== req.user.userId
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden"
        });
      }

      // 🧨 DELETE PROJECT
      await pool.query(
        "DELETE FROM projects WHERE id=$1",
        [project.id]
      );

      // 🧾 AUDIT LOG
      await auditLog({
        tenantId: req.tenantId,
        userId: req.user.userId,
        action: "DELETE_PROJECT",
        entityType: "project",
        entityId: project.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Project deleted successfully"
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);


module.exports = router;
