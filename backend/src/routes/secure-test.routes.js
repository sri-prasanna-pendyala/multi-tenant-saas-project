const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const tenantGuard = require("../middleware/tenantGuard");

const router = express.Router();

router.get(
  "/tenant-admin-only",
  auth,
  requireRole("tenant_admin"),
  tenantGuard,
  (req, res) => {
    res.json({
      success: true,
      message: "Tenant admin access granted",
      tenantId: req.tenantId
    });
  }
);

module.exports = router;
