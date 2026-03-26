const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const auditLog = async (tenantId, userId, action, entityType, entityId, ipAddress = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), tenantId, userId, action, entityType, entityId, ipAddress]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

module.exports = { auditLog };
