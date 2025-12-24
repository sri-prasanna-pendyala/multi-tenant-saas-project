CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial');
CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'enterprise');

CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  status tenant_status NOT NULL DEFAULT 'active',
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  max_users INTEGER NOT NULL,
  max_projects INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
