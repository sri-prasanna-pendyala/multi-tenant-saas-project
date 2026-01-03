const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/db");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * REGISTER TENANT
 */
router.post("/register-tenant", async (req, res) => {
  const { tenantName, subdomain, adminEmail, adminPassword, adminFullName } = req.body;

  try {
    await pool.query("BEGIN");

    const tenantId = uuidv4();

    await pool.query(
      `INSERT INTO tenants (
        id, name, subdomain, status, subscription_plan, max_users, max_projects
      ) VALUES ($1, $2, $3, 'active', 'free', 5, 3)`,
      [tenantId, tenantName, subdomain]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (
        id, tenant_id, email, password_hash, full_name, role
      ) VALUES ($1, $2, $3, $4, $5, 'tenant_admin')`,
      [userId, tenantId, adminEmail, passwordHash, adminFullName]
    );

    await pool.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Tenant registered successfully",
      data: {
        tenantId,
        subdomain,
        adminUser: {
          id: userId,
          email: adminEmail,
          fullName: adminFullName,
          role: "tenant_admin"
        }
      }
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    return res.status(400).json({ success: false, message: err.message });
  }
});
router.post("/login", async (req, res) => {
  const { email, password, tenantSubdomain } = req.body;

  try {
    // 🔹 STEP 1: Check if user is super_admin
    const superAdminRes = await pool.query(
      `SELECT * FROM users WHERE email=$1 AND role='super_admin'`,
      [email]
    );

    if (superAdminRes.rows.length) {
      const user = superAdminRes.rows[0];

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          tenantId: null,
          role: "super_admin"
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      return res.json({
        success: true,
        data: {
          token,
          expiresIn: 86400,
          user: {
            id: user.id,
            email: user.email,
            role: "super_admin",
            tenantId: null
          }
        }
      });
    }

    // 🔹 STEP 2: Normal tenant user login (existing logic)
    if (!tenantSubdomain) {
      return res.status(400).json({
        success: false,
        message: "Tenant subdomain is required"
      });
    }

    const tenantRes = await pool.query(
      `SELECT * FROM tenants WHERE subdomain=$1`,
      [tenantSubdomain]
    );

    if (!tenantRes.rows.length) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    const tenant = tenantRes.rows[0];

    const userRes = await pool.query(
      `SELECT * FROM users WHERE email=$1 AND tenant_id=$2`,
      [email, tenant.id]
    );

    if (!userRes.rows.length) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        token,
        expiresIn: 86400,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



/**
 * GET CURRENT USER
 */
router.get("/me", auth, async (req, res) => {
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role,
              t.id as tenant_id, t.name, t.subdomain,
              t.subscription_plan, t.max_users, t.max_projects
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id=$1`,
      [req.user.userId]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const row = userRes.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        tenant: row.tenant_id
          ? {
              id: row.tenant_id,
              name: row.name,
              subdomain: row.subdomain,
              subscriptionPlan: row.subscription_plan,
              maxUsers: row.max_users,
              maxProjects: row.max_projects
            }
          : null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
