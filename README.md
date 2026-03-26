# TenantFlow — Multi-Tenant SaaS Platform

A production-ready, multi-tenant SaaS application for project and task management. Multiple organizations can independently register, manage teams, create projects, and track tasks with complete data isolation, role-based access control, and subscription plan enforcement.

---

## Features

- **Multi-Tenant Architecture** — Shared database with tenant_id isolation; each tenant's data is completely isolated
- **JWT Authentication** — Stateless 24-hour tokens carrying userId, tenantId, and role
- **Role-Based Access Control** — Three roles: Super Admin, Tenant Admin, and Member with enforced permissions at the API level
- **Subscription Plans** — Free (5 users, 3 projects), Pro (25/15), Enterprise (100/50) with automatic limit enforcement
- **Project Management** — Create, update, archive, and delete projects with task counts and creator tracking
- **Task Management** — Kanban-style task board with status, priority, assignment, and due date tracking
- **User Management** — Invite team members, manage roles and active status
- **Audit Logging** — All CREATE/UPDATE/DELETE operations logged with user, tenant, and IP address
- **Docker Containerization** — Full three-service Docker Compose setup with automatic migrations and seeds
- **Responsive UI** — Dark-themed React SPA that works on desktop and mobile

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React.js | 18.2 |
| Frontend Routing | React Router | 6.x |
| HTTP Client | Axios | 1.6 |
| Backend | Node.js + Express | 18 LTS + 4.18 |
| Database | PostgreSQL | 15 |
| Authentication | JWT (jsonwebtoken) | 9.x |
| Password Hashing | bcryptjs | 2.4 |
| Container | Docker + Docker Compose | Latest |
| HTTP Security | Helmet.js | 7.x |

---

## Quick Start (Docker)

**Prerequisites:** Docker Desktop installed and running.

```bash
# 1. Clone the repository
git clone <repository-url>
cd saas-project

# 2. Start all services
docker-compose up -d

# 3. Wait ~30 seconds for migrations and seed data
docker-compose logs -f backend

# 4. Open the app
open http://localhost:3000
```

**Services:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432

---

## Architecture Overview

```
Browser → Frontend (React, :3000) → Backend API (Express, :5000) → PostgreSQL (:5432)
```

All three services run in a Docker network. The backend automatically runs database migrations and loads seed data on startup before accepting requests. See `docs/architecture.md` for full diagrams.

![System Architecture](docs/images/system-architecture.png)

---

## Demo Credentials

| Role | Email | Password | Subdomain |
|---|---|---|---|
| Super Admin | superadmin@system.com | Admin@123 | (leave blank) |
| Tenant Admin | admin@demo.com | Demo@123 | demo |
| Regular User | user1@demo.com | User@123 | demo |
| Regular User | user2@demo.com | User@123 | demo |

---

## Environment Variables

All variables are defined in `backend/.env` and `docker-compose.yml`. For Docker deployment, variables in `docker-compose.yml` take precedence.

| Variable | Description | Default |
|---|---|---|
| DB_HOST | PostgreSQL hostname | database (Docker) / localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | saas_db |
| DB_USER | Database user | postgres |
| DB_PASSWORD | Database password | postgres123 |
| JWT_SECRET | JWT signing secret (min 32 chars) | see .env |
| JWT_EXPIRES_IN | Token expiry | 24h |
| PORT | API server port | 5000 |
| FRONTEND_URL | CORS allowed origin | http://frontend:3000 |

---

## API Documentation

Full API documentation for all 19 endpoints: [docs/API.md](docs/API.md)

**Quick reference:**
- `POST /api/auth/register-tenant` — Register new organization
- `POST /api/auth/login` — Login with email + password + subdomain
- `GET /api/auth/me` — Get current user profile
- `GET /api/tenants` — List all tenants (super_admin)
- `GET /api/tenants/:id/users` — List tenant users
- `POST /api/tenants/:id/users` — Add user to tenant
- `GET /api/projects` — List projects
- `POST /api/projects` — Create project
- `GET /api/projects/:id/tasks` — List tasks
- `POST /api/projects/:id/tasks` — Create task
- `PATCH /api/tasks/:id/status` — Update task status
- `GET /api/health` — Health check

---

## Documentation

- [Research & Multi-Tenancy Analysis](docs/research.md)
- [Product Requirements Document](docs/PRD.md)
- [Architecture Document](docs/architecture.md)
- [Technical Specification](docs/technical-spec.md)
- [API Documentation](docs/API.md)

---

## Docker Commands

```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose down -v        # Stop and reset database
docker-compose logs -f        # Follow all logs
docker-compose ps             # Check service status
docker-compose up -d --build  # Rebuild and restart
```

---

## Demo Video

[Watch the demo video on YouTube](https://youtube.com/your-video-link)
