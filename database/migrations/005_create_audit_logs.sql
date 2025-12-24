CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL
);
