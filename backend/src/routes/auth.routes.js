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
      `INSERT INTO tenants (id, name, subdomain, subscription_plan, max_users, max_projects)
       VALUES ($1, $2, $3, 'free', 5, 3)`,
      [tenantId, tenantName, subdomain]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const userId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5, 'tenant_admin')`,
      [userId, tenantId, adminEmail, passwordHash, adminFullName]
    );

    await pool.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Tenant registered successfully",
      data: { tenantId, subdomain }
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
  const { email, password, tenantSubdomain } = req.body;

  try {
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
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
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
 * ME
 */
router.get("/me", auth, async (req, res) => {
  const userRes = await pool.query(
    `SELECT id, email, full_name, role FROM users WHERE id=$1`,
    [req.user.userId]
  );

  res.json({ success: true, data: userRes.rows[0] });
});

module.exports = router;
