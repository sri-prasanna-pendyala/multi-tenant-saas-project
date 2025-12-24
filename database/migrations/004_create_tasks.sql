CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  assigned_to UUID,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_project FOREIGN KEY (project_id)
    REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_assignee FOREIGN KEY (assigned_to)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_tenant_project ON tasks(tenant_id, project_id);
