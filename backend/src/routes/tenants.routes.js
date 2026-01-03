const express = require("express");
const auth = require("../middleware/auth");
const tenantGuard = require("../middleware/tenantGuard");
const { pool } = require("../config/db");

const router = express.Router();

/**
 * API 5: GET TENANT DETAILS
 * GET /api/tenants/:tenantId
 */
router.get("/:tenantId", auth, tenantGuard, async (req, res) => {
  const { tenantId } = req.params;

  try {
    // Tenant admins can only access their own tenant
    if (req.user.role !== "super_admin" && req.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to tenant"
      });
    }

    const tenantRes = await pool.query(
      `SELECT id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at
       FROM tenants WHERE id=$1`,
      [tenantId]
    );

    if (!tenantRes.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found"
      });
    }

    const tenant = tenantRes.rows[0];

    const usersCount = await pool.query(
      `SELECT COUNT(*) FROM users WHERE tenant_id=$1`,
      [tenantId]
    );

    const projectsCount = await pool.query(
      `SELECT COUNT(*) FROM projects WHERE tenant_id=$1`,
      [tenantId]
    );

    const tasksCount = await pool.query(
      `SELECT COUNT(*) FROM tasks WHERE tenant_id=$1`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        ...tenant,
        stats: {
          totalUsers: parseInt(usersCount.rows[0].count),
          totalProjects: parseInt(projectsCount.rows[0].count),
          totalTasks: parseInt(tasksCount.rows[0].count)
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

/**
 * API 6: UPDATE TENANT
 * PUT /api/tenants/:tenantId
 */
router.put("/:tenantId", auth, tenantGuard, async (req, res) => {
  const { tenantId } = req.params;
  const {
    name,
    status,
    subscription_plan,
    max_users,
    max_projects
  } = req.body;

  try {
    // Tenant admin can update only name
    if (req.user.role === "tenant_admin") {
      if (req.tenantId !== tenantId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized access"
        });
      }

      if (
        status !== undefined ||
        subscription_plan !== undefined ||
        max_users !== undefined ||
        max_projects !== undefined
      ) {
        return res.status(403).json({
          success: false,
          message: "Tenant admin cannot update subscription or limits"
        });
      }

      await pool.query(
        `UPDATE tenants SET name=$1, updated_at=NOW() WHERE id=$2`,
        [name, tenantId]
      );

      return res.json({
        success: true,
        message: "Tenant updated successfully",
        data: { id: tenantId, name }
      });
    }

    // Super admin can update everything
    if (req.user.role === "super_admin") {
      await pool.query(
        `UPDATE tenants
         SET name = COALESCE($1, name),
             status = COALESCE($2, status),
             subscription_plan = COALESCE($3, subscription_plan),
             max_users = COALESCE($4, max_users),
             max_projects = COALESCE($5, max_projects),
             updated_at = NOW()
         WHERE id=$6`,
        [
          name,
          status,
          subscription_plan,
          max_users,
          max_projects,
          tenantId
        ]
      );

      return res.json({
        success: true,
        message: "Tenant updated successfully",
        data: { id: tenantId }
      });
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
/**
 * API 7: LIST ALL TENANTS (SUPER ADMIN ONLY)
 * GET /api/tenants
 */
router.get("/", auth, async (req, res) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }

  const page = parseInt(req.query.page || 1);
  const limit = Math.min(parseInt(req.query.limit || 10), 100);
  const offset = (page - 1) * limit;

  const { status, subscriptionPlan } = req.query;

  try {
    let filters = [];
    let values = [];
    let idx = 1;

    if (status) {
      filters.push(`t.status = $${idx++}`);
      values.push(status);
    }

    if (subscriptionPlan) {
      filters.push(`t.subscription_plan = $${idx++}`);
      values.push(subscriptionPlan);
    }

    const whereClause = filters.length
      ? `WHERE ${filters.join(" AND ")}`
      : "";

    const tenantsQuery = `
      SELECT
        t.id,
        t.name,
        t.subdomain,
        t.status,
        t.subscription_plan,
        t.created_at,
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT p.id) AS total_projects
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN projects p ON p.tenant_id = t.id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const tenants = await pool.query(
      tenantsQuery,
      [...values, limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM tenants t ${whereClause}`,
      values
    );

    const totalTenants = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalTenants / limit);

    res.json({
      success: true,
      data: {
        tenants: tenants.rows.map(t => ({
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          subscriptionPlan: t.subscription_plan,
          totalUsers: Number(t.total_users),
          totalProjects: Number(t.total_projects),
          createdAt: t.created_at
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalTenants,
          limit
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


module.exports = router;
