INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Demo Company',
  'demo',
  'active',
  'pro',
  25,
  15
);

INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NULL,
  'superadmin@system.com',
  '$2b$10$KIX0Zg9h6n0Y1JZxTz7qOeN6pXW5R8X1z9xJp6H3vM0z9xZyQyH9y',
  'Super Admin',
  'super_admin'
);

INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'admin@demo.com',
  '$2b$10$KIX0Zg9h6n0Y1JZxTz7qOeN6pXW5R8X1z9xJp6H3vM0z9xZyQyH9y',
  'Demo Admin',
  'tenant_admin'
);
