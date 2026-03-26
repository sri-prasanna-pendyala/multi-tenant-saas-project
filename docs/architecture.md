# Architecture Document
## Multi-Tenant SaaS Platform

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌───────────────┐  │
│   │   FRONTEND   │────▶│   BACKEND    │────▶│   DATABASE    │  │
│   │  React SPA   │     │  Express API │     │  PostgreSQL   │  │
│   │  Port 3000   │     │  Port 5000   │     │  Port 5432    │  │
│   └──────────────┘     └──────────────┘     └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Browser ──HTTPS──▶ Frontend (3000) ──HTTP──▶ Backend API (5000) ──TCP──▶ PostgreSQL (5432)
```

### Component Responsibilities

**Frontend (React SPA)**
- Single Page Application served from port 3000
- Handles routing, authentication state, and UI
- Communicates with backend via REST API calls
- JWT token stored in localStorage
- Protected routes redirect unauthenticated users to /login

**Backend (Express.js API)**
- RESTful API server on port 5000
- JWT authentication middleware on protected routes
- Role-based authorization middleware
- Parameterized SQL queries via node-postgres
- Audit logging for all mutating operations
- Runs database migrations and seeds on startup

**Database (PostgreSQL 15)**
- Single shared database for all tenants
- Row-level tenant isolation via tenant_id column
- Indexes on all tenant_id columns for performance
- Composite unique constraint: UNIQUE(tenant_id, email)
- CASCADE delete for referential integrity

---

## 2. Authentication Flow

```
1. User submits email + password + subdomain
2. Backend finds tenant by subdomain
3. Backend finds user by email + tenant_id
4. bcrypt.compare(password, hash)
5. jwt.sign({ userId, tenantId, role }, secret, { expiresIn: '24h' })
6. Token returned to client, stored in localStorage
7. Subsequent requests: Authorization: Bearer <token>
8. authenticate middleware: jwt.verify(token) → req.user
9. Route handlers use req.user.tenantId for all queries
```

---

## 3. Database Schema (ERD)

```
┌─────────────────────────────────────────────────────────────────┐
│ tenants                                                          │
│ ─────────────────────────────────────────────────────────────── │
│ id (PK, VARCHAR(36))                                            │
│ name (VARCHAR, NOT NULL)                                        │
│ subdomain (VARCHAR, UNIQUE, NOT NULL)                           │
│ status (ENUM: active|suspended|trial)                           │
│ subscription_plan (ENUM: free|pro|enterprise)                   │
│ max_users (INTEGER)                                             │
│ max_projects (INTEGER)                                          │
│ created_at, updated_at (TIMESTAMP)                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ 1:N
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ users           │  │ projects     │  │ audit_logs           │
│ ─────────────── │  │ ──────────── │  │ ──────────────────── │
│ id (PK)         │  │ id (PK)      │  │ id (PK)              │
│ tenant_id (FK)  │  │ tenant_id FK │  │ tenant_id (FK)       │
│ email           │  │ name         │  │ user_id (FK)         │
│ password_hash   │  │ description  │  │ action               │
│ full_name       │  │ status       │  │ entity_type          │
│ role            │  │ created_by   │  │ entity_id            │
│ is_active       │  │ created_at   │  │ ip_address           │
│ created_at      │  │ updated_at   │  │ created_at           │
│ UNIQUE(tid,email)│  │ INDEX(tid)   │  │ INDEX(tenant_id)     │
└────────┬────────┘  └──────┬───────┘  └──────────────────────┘
         │                  │ 1:N
         │     ┌────────────▼───────────────────────┐
         │     │ tasks                               │
         │     │ ──────────────────────────────────  │
         │     │ id (PK)                             │
         │     │ project_id (FK → projects)          │
         │     │ tenant_id (FK → tenants)            │
         │     │ title                               │
         │     │ description                         │
         │     │ status (todo|in_progress|completed) │
         │     │ priority (low|medium|high)          │
         └─────▶ assigned_to (FK → users, NULLABLE) │
               │ due_date                            │
               │ INDEX(tenant_id, project_id)        │
               └─────────────────────────────────────┘
```

---

## 4. API Endpoint List

### Authentication
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | /api/auth/register-tenant | None | Public |
| POST | /api/auth/login | None | Public |
| GET | /api/auth/me | JWT | Any |
| POST | /api/auth/logout | JWT | Any |

### Tenant Management
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/tenants | JWT | super_admin |
| GET | /api/tenants/:tenantId | JWT | Same tenant or super_admin |
| PUT | /api/tenants/:tenantId | JWT | tenant_admin (own), super_admin (all) |
| GET | /api/tenants/:tenantId/users | JWT | Same tenant or super_admin |
| POST | /api/tenants/:tenantId/users | JWT | tenant_admin |

### User Management
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| PUT | /api/users/:userId | JWT | Self (name only), tenant_admin, super_admin |
| DELETE | /api/users/:userId | JWT | tenant_admin, super_admin |

### Project Management
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | /api/projects | JWT | Any tenant user |
| GET | /api/projects | JWT | Any tenant user |
| PUT | /api/projects/:projectId | JWT | tenant_admin or creator |
| DELETE | /api/projects/:projectId | JWT | tenant_admin or creator |

### Task Management
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | /api/projects/:projectId/tasks | JWT | Any tenant user |
| GET | /api/projects/:projectId/tasks | JWT | Any tenant user |
| PATCH | /api/tasks/:taskId/status | JWT | Any tenant user |
| PUT | /api/tasks/:taskId | JWT | Any tenant user |
| DELETE | /api/tasks/:taskId | JWT | tenant_admin, super_admin |

### System
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/health | None | Public |
