const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

module.exports = async ({ tenantId, userId, action, entityType, entityId, ip }) => {
  await pool.query(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uuidv4(), tenantId, userId, action, entityType, entityId, ip || null]
  );
};
