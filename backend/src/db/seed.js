require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'saas_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function seed() {
  const client = await pool.connect();
  try {
    // Check if already seeded
    const existing = await client.query("SELECT id FROM users WHERE email = 'superadmin@system.com' LIMIT 1");
    if (existing.rows.length > 0) {
      console.log('Seed data already exists, skipping...');
      return;
    }

    console.log('Seeding database...');

    const superAdminId = uuidv4();
    const demoTenantId = uuidv4();
    const tenantAdminId = uuidv4();
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const project1Id = uuidv4();
    const project2Id = uuidv4();
    const task1Id = uuidv4();
    const task2Id = uuidv4();
    const task3Id = uuidv4();
    const task4Id = uuidv4();
    const task5Id = uuidv4();

    const superAdminHash = await bcrypt.hash('Admin@123', 12);
    const adminHash = await bcrypt.hash('Demo@123', 12);
    const userHash = await bcrypt.hash('User@123', 12);

    await client.query('BEGIN');

    // Super admin (tenant_id = NULL)
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, NULL, $2, $3, $4, 'super_admin', true)`,
      [superAdminId, 'superadmin@system.com', superAdminHash, 'Super Administrator']
    );

    // Demo tenant
    await client.query(
      `INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects)
       VALUES ($1, $2, $3, 'active', 'pro', 25, 15)`,
      [demoTenantId, 'Demo Company', 'demo']
    );

    // Tenant admin
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'Demo Admin', 'tenant_admin', true)`,
      [tenantAdminId, demoTenantId, 'admin@demo.com', adminHash]
    );

    // Regular users
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'User One', 'user', true)`,
      [user1Id, demoTenantId, 'user1@demo.com', userHash]
    );

    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'User Two', 'user', true)`,
      [user2Id, demoTenantId, 'user2@demo.com', userHash]
    );

    // Projects
    await client.query(
      `INSERT INTO projects (id, tenant_id, name, description, status, created_by)
       VALUES ($1, $2, 'Project Alpha', 'First demo project for the Demo Company', 'active', $3)`,
      [project1Id, demoTenantId, tenantAdminId]
    );

    await client.query(
      `INSERT INTO projects (id, tenant_id, name, description, status, created_by)
       VALUES ($1, $2, 'Project Beta', 'Second demo project for the Demo Company', 'active', $3)`,
      [project2Id, demoTenantId, tenantAdminId]
    );

    // Tasks
    const tasks = [
      [task1Id, project1Id, demoTenantId, 'Design homepage mockup', 'Create high-fidelity designs', 'in_progress', 'high', user1Id],
      [task2Id, project1Id, demoTenantId, 'Backend API setup', 'Setup REST API endpoints', 'todo', 'high', user2Id],
      [task3Id, project1Id, demoTenantId, 'Write unit tests', 'Cover all critical paths', 'todo', 'medium', null],
      [task4Id, project2Id, demoTenantId, 'Database schema design', 'Design ERD and migrations', 'completed', 'high', user1Id],
      [task5Id, project2Id, demoTenantId, 'Deploy to staging', 'Setup CI/CD pipeline', 'todo', 'medium', user2Id],
    ];

    for (const task of tasks) {
      await client.query(
        `INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        task
      );
    }

    // Add audit log
    await client.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, 'SEED_DATA', 'system', $4)`,
      [uuidv4(), demoTenantId, tenantAdminId, demoTenantId]
    );

    await client.query('COMMIT');
    console.log('Seed data inserted successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
