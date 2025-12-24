const express = require("express");
const { v4: uuidv4 } = require("uuid");
const auth = require("../middleware/auth");
const tenantGuard = require("../middleware/tenantGuard");
const { pool } = require("../config/db");
const auditLog = require("../utils/auditLogger");

const router = express.Router();

/**
 * CREATE TASK
 * POST /api/projects/:projectId/tasks
 */
router.post(
  "/projects/:projectId/tasks",
  auth,
  tenantGuard,
  async (req, res) => {
    const { title, description = "", priority = "medium", assignedTo, dueDate } = req.body;

    const projectRes = await pool.query(
      "SELECT tenant_id FROM projects WHERE id=$1",
      [req.params.projectId]
    );

    if (!projectRes.rows.length) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (projectRes.rows[0].tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (assignedTo) {
      const userRes = await pool.query(
        "SELECT id FROM users WHERE id=$1 AND tenant_id=$2",
        [assignedTo, req.tenantId]
      );
      if (!userRes.rows.length) {
        return res.status(400).json({ success: false, message: "Invalid assigned user" });
      }
    }

    const taskId = uuidv4();

    await pool.query(
      `INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date)
       VALUES ($1,$2,$3,$4,$5,'todo',$6,$7,$8)`,
      [
        taskId,
        req.params.projectId,
        req.tenantId,
        title,
        description,
        priority,
        assignedTo || null,
        dueDate || null
      ]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "CREATE_TASK",
      entityType: "task",
      entityId: taskId,
      ip: req.ip
    });

    res.status(201).json({ success: true, data: { id: taskId } });
  }
);

/**
 * LIST TASKS
 * GET /api/projects/:projectId/tasks
 */
router.get(
  "/projects/:projectId/tasks",
  auth,
  tenantGuard,
  async (req, res) => {
    const projectRes = await pool.query(
      "SELECT tenant_id FROM projects WHERE id=$1",
      [req.params.projectId]
    );

    if (!projectRes.rows.length || projectRes.rows[0].tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const tasks = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date,
              u.full_name AS assigned_to
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id=$1
       ORDER BY t.priority DESC, t.due_date ASC`,
      [req.params.projectId]
    );

    res.json({ success: true, data: tasks.rows });
  }
);

/**
 * UPDATE TASK STATUS
 * PATCH /api/tasks/:taskId/status
 */
router.patch(
  "/tasks/:taskId/status",
  auth,
  tenantGuard,
  async (req, res) => {
    const { status } = req.body;

    const taskRes = await pool.query(
      "SELECT tenant_id FROM tasks WHERE id=$1",
      [req.params.taskId]
    );

    if (!taskRes.rows.length || taskRes.rows[0].tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query(
      "UPDATE tasks SET status=$1 WHERE id=$2",
      [status, req.params.taskId]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "UPDATE_TASK_STATUS",
      entityType: "task",
      entityId: req.params.taskId,
      ip: req.ip
    });

    res.json({ success: true, message: "Task status updated" });
  }
);

/**
 * UPDATE TASK
 * PUT /api/tasks/:taskId
 */
router.put(
  "/tasks/:taskId",
  auth,
  tenantGuard,
  async (req, res) => {
    const { title, description, priority, assignedTo, dueDate, status } = req.body;

    const taskRes = await pool.query(
      "SELECT tenant_id FROM tasks WHERE id=$1",
      [req.params.taskId]
    );

    if (!taskRes.rows.length || taskRes.rows[0].tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (assignedTo) {
      const userRes = await pool.query(
        "SELECT id FROM users WHERE id=$1 AND tenant_id=$2",
        [assignedTo, req.tenantId]
      );
      if (!userRes.rows.length) {
        return res.status(400).json({ success: false, message: "Invalid assigned user" });
      }
    }

    await pool.query(
      `UPDATE tasks
       SET title=COALESCE($1,title),
           description=COALESCE($2,description),
           priority=COALESCE($3,priority),
           assigned_to=$4,
           due_date=$5,
           status=COALESCE($6,status)
       WHERE id=$7`,
      [title, description, priority, assignedTo || null, dueDate || null, status, req.params.taskId]
    );

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "UPDATE_TASK",
      entityType: "task",
      entityId: req.params.taskId,
      ip: req.ip
    });

    res.json({ success: true, message: "Task updated" });
  }
);

/**
 * DELETE TASK
 * DELETE /api/tasks/:taskId
 */
router.delete(
  "/tasks/:taskId",
  auth,
  tenantGuard,
  async (req, res) => {
    const taskRes = await pool.query(
      "SELECT tenant_id FROM tasks WHERE id=$1",
      [req.params.taskId]
    );

    if (!taskRes.rows.length || taskRes.rows[0].tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query("DELETE FROM tasks WHERE id=$1", [req.params.taskId]);

    await auditLog({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: "DELETE_TASK",
      entityType: "task",
      entityId: req.params.taskId,
      ip: req.ip
    });

    res.json({ success: true, message: "Task deleted" });
  }
);

module.exports = router;
