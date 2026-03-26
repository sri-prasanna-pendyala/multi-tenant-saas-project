# Technical Specification
## Multi-Tenant SaaS Platform

---

## 1. Project Structure

### Backend Structure

```
backend/
├── Dockerfile                    # Container definition
├── entrypoint.sh                 # Startup script: migrations → seeds → server
├── package.json                  # Dependencies
├── .env                          # Environment variables (committed for dev)
└── src/
    ├── index.js                  # Express app setup, middleware, route mounting
    ├── config/
    │   └── database.js           # PostgreSQL connection pool (pg.Pool)
    ├── db/
    │   ├── migrate.js            # Programmatic schema migrations runner
    │   └── seed.js               # Seed data loader (idempotent)
    ├── middleware/
    │   └── auth.js               # JWT authenticate, requireRole, requireSuperAdmin
    ├── routes/
    │   ├── auth.js               # POST /register-tenant, POST /login, GET /me, POST /logout
    │   ├── tenants.js            # GET /, GET /:id, PUT /:id, GET /:id/users, POST /:id/users
    │   ├── users.js              # PUT /:userId, DELETE /:userId
    │   ├── projects.js           # POST /, GET /, PUT /:id, DELETE /:id, + tasks nested
    │   └── tasks.js              # PATCH /:id/status, PUT /:id, DELETE /:id
    └── utils/
        └── audit.js              # auditLog(tenantId, userId, action, entityType, entityId, ip)
```

**Purpose of each folder:**
- `config/` — Database connection and environment configuration
- `db/` — Database lifecycle scripts (run once on startup, not on every request)
- `middleware/` — Express middleware that runs before route handlers
- `routes/` — Route handlers grouped by domain (auth, tenants, users, projects, tasks)
- `utils/` — Shared utility functions used across routes

---

### Frontend Structure

```
frontend/
├── Dockerfile                    # Container definition (node:18-alpine, npm start)
├── package.json                  # React dependencies
└── src/
    ├── index.js                  # ReactDOM.createRoot entry point
    ├── index.css                 # Global CSS (CSS variables, utility classes)
    ├── App.js                    # BrowserRouter, AuthProvider, all Routes
    ├── context/
    │   └── AuthContext.js        # useAuth hook, loginUser, logoutUser, fetchUser
    ├── services/
    │   └── api.js                # Axios instance + all API call functions
    ├── components/
    │   ├── common/
    │   │   └── Modal.js          # Reusable modal with overlay, Escape key handling
    │   └── layout/
    │       └── Layout.js         # Sidebar navigation, user info, logout
    └── pages/
        ├── LoginPage.js          # Login form with demo credential shortcuts
        ├── RegisterPage.js       # Tenant registration form with validation
        ├── DashboardPage.js      # Stats cards, recent projects, my tasks
        ├── ProjectsPage.js       # Projects grid with create/edit/delete modals
        ├── ProjectDetailPage.js  # Kanban-style task board for a project
        ├── UsersPage.js          # User management table (tenant_admin only)
        └── TenantsPage.js        # Tenant management table (super_admin only)
```

---

## 2. Development Setup Guide

### Prerequisites

- Node.js 18 LTS or higher
- npm 9+
- Docker Desktop (for containerized setup)
- PostgreSQL 15 (for local non-Docker setup)
- Git

### Environment Variables

Backend `.env` file (already included in repository):

```env
DB_HOST=localhost          # PostgreSQL host
DB_PORT=5432               # PostgreSQL port
DB_NAME=saas_db            # Database name
DB_USER=postgres           # Database user
DB_PASSWORD=postgres123    # Database password
JWT_SECRET=super_secret_jwt_key_for_saas_app_2024_min32chars  # Min 32 chars
JWT_EXPIRES_IN=24h         # Token expiry
PORT=5000                  # API server port
NODE_ENV=development       # Environment
FRONTEND_URL=http://localhost:3000  # CORS allowed origin
```

---

### Option A: Docker Setup (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd saas-project

# 2. Start all services (database, backend, frontend)
docker-compose up -d

# 3. Wait ~30 seconds for migrations and seeds to complete
# Check backend logs:
docker-compose logs -f backend

# 4. Verify health
curl http://localhost:5000/api/health

# 5. Access frontend
open http://localhost:3000
```

**Services after startup:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: localhost:5432

---

### Option B: Local Development Setup

**Step 1: Set up PostgreSQL**
```bash
# Create database
psql -U postgres -c "CREATE DATABASE saas_db;"
```

**Step 2: Backend setup**
```bash
cd backend
npm install

# Run migrations
node src/db/migrate.js

# Run seeds
node src/db/seed.js

# Start dev server
npm run dev   # Uses nodemon for hot reload
# OR
npm start     # Production mode
```

**Step 3: Frontend setup**
```bash
cd frontend
npm install

# Set API URL (optional, defaults to localhost:5000)
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env.local

npm start     # Starts on port 3000
```

---

### Docker Commands Reference

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database

# Check status
docker-compose ps

# Stop all services
docker-compose down

# Stop and remove volumes (reset database)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build

# Execute commands inside containers
docker exec -it backend sh
docker exec -it database psql -U postgres -d saas_db
```

---

## 3. Key Implementation Details

### Tenant Isolation Pattern

Every route that accesses tenant-specific data extracts `tenantId` from `req.user` (populated by JWT middleware), not from the request body or query parameters. This prevents privilege escalation:

```javascript
// CORRECT: tenantId from JWT
const result = await pool.query(
  'SELECT * FROM projects WHERE tenant_id = $1',
  [req.user.tenantId]  // from JWT, not req.body
);

// WRONG: tenantId from user input
const result = await pool.query(
  'SELECT * FROM projects WHERE tenant_id = $1',
  [req.body.tenantId]  // never trust client-supplied tenantId
);
```

### Transaction Pattern (Tenant Registration)

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Create tenant
  await client.query('INSERT INTO tenants ...', [...]);
  // Create admin user
  await client.query('INSERT INTO users ...', [...]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Idempotent Seeds

The seed script checks for existing data before inserting to prevent duplicate seed data on container restarts:

```javascript
const existing = await client.query(
  "SELECT id FROM users WHERE email = 'superadmin@system.com' LIMIT 1"
);
if (existing.rows.length > 0) {
  console.log('Seed data already exists, skipping...');
  return;
}
```
