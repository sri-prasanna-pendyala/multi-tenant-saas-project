CREATE TYPE project_status AS ENUM ('active', 'archived', 'completed');

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status project_status DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_creator FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);
