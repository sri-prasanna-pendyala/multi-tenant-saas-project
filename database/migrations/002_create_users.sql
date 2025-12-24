CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'user');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);
