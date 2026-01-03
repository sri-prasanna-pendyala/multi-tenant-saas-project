TASK: Build a Multi-Tenant SaaS Project & Task Management Platform

----------- Project Overview ----------
This project is a full-stack multi-tenant SaaS application where multiple organizations (tenants) can independently manage their users, projects, and tasks with strict data isolation and role-based access control.

The main goal of this project was to understand how real SaaS systems handle:
- multi-tenancy with proper data isolation
- authentication and authorization at scale
- role-based access control (RBAC)
- secure backend–frontend integration
- production-ready API behavior

*** While building this project, I encountered real-world issues such as JWT validation failures, tenant-scoping bugs, incorrect route mounting, Docker container startup dependencies, UUID handling errors, and frontend state synchronization problems. Fixing these helped me understand how production systems behave beyond simple CRUD apps.

Instead of focusing only on UI or basic APIs, this project focuses on:
- correct multi-tenant architecture
- strong authorization boundaries
- clean and predictable API design
- backend-driven security guarantees
- realistic debugging and fixes

----------- Tech Stack Used ----------
- Node.js + Express – backend REST API
- PostgreSQL – relational database with strong constraints
- React – frontend user interface
- JWT – stateless authentication and authorization
- Docker & Docker Compose – containerized development environment
- Axios – frontend API communication

----------- Authentication & Authorization ----------
The system uses JWT-based authentication with a 24-hour expiry.

Three roles are supported:
- SUPER_ADMIN
- TENANT_ADMIN
- USER

Role-based access control is strictly enforced:
- SUPER_ADMIN can access and manage all tenants
- TENANT_ADMIN can manage users, projects, and tasks within their tenant
- USER can view projects and manage task status within their tenant
- SUPER_ADMIN does not belong to any tenant (tenant_id = NULL)

JWT tokens include:
- userId
- tenantId (NULL for super_admin)
- role

Every protected API request verifies:
- token validity and expiry
- user role
- tenant ownership (except for super_admin)

----------- Multi-Tenancy Design ----------
This project uses a **shared database with tenant-isolated data model**.

Key principles:
- Every core table includes a `tenant_id` column
- Tenant ID is extracted from the JWT token
- All tenant-level queries are filtered by `tenant_id`
- Client-provided tenant IDs are never trusted
- SUPER_ADMIN bypasses tenant filtering where required

This guarantees:
- No tenant can access another tenant’s data
- Strong isolation even if API endpoints are manipulated

----------- How the Code is Structured ----------
Backend architecture follows separation of concerns:

Routes → Middleware → Controllers → Database

- Routes define API endpoints
- Middleware handles authentication, authorization, and tenant isolation
- Controllers implement business logic
- PostgreSQL enforces data integrity with foreign keys and constraints

Frontend structure:
- Pages for each major feature (auth, projects, users, tasks)
- Centralized API layer with Axios and JWT injection
- Protected routes to prevent unauthorized access
- Role-based UI rendering

----------- Database Design ----------
Core entities:
- tenants
- users
- projects
- tasks
- audit_logs

Important design decisions:
- UUIDs used for all primary keys
- Composite unique constraint on (tenant_id, email)
- SUPER_ADMIN users have tenant_id = NULL
- Foreign keys with CASCADE delete where appropriate
- audit_logs table tracks important actions (create, update, delete)

----------- Subscription & Limits ----------
Each tenant has a subscription plan:
- free
- pro
- enterprise

Limits enforced at API level:
- max_users
- max_projects

Before creating users or projects:
- current count is checked
- limits are enforced
- API returns 403 if limits are exceeded

New tenants start with the free plan by default.

----------- Project Management ----------
Projects are scoped to a tenant and include:
- name
- description
- status (active, archived, completed)
- created_by
- tenant_id

Supported operations:
- Create project (TENANT_ADMIN)
- List tenant projects
- View project details
- Update project (TENANT_ADMIN or creator)
- Delete project (TENANT_ADMIN or creator)

Project deletion cascades to tasks.

----------- Task Management ----------
Tasks always belong to:
- a project
- a tenant

Task fields include:
- title
- description
- status (todo, in_progress, completed)
- priority
- assigned_to
- due_date
- tenant_id

Supported operations:
- Create task under a project
- List tasks by project
- Update task status (PATCH)
- Update full task details
- Delete task (TENANT_ADMIN only)

Tenant ID for tasks is derived from the project, not from JWT.

----------- Frontend Behavior ----------
The frontend is built with React and focuses on correctness and clarity.

Key frontend features:
- Tenant-based login
- Protected routes
- Projects list and details pages
- Inline task creation
- Task status updates via dropdown
- Role-based UI rendering (admin-only actions)
- Immediate UI updates without page reloads

----------- Dockerized Setup ----------
The entire application runs using Docker Compose.

Services:
- database (PostgreSQL)
- backend (Node.js API)
- frontend (React app)

Docker ensures:
- consistent environment
- production-like networking
- service dependency handling
- one-command startup

Health check endpoint:
GET /api/health
Returns backend and database status after migrations and seed data load.

----------- Setup Instructions ----------

--> Prerequisites
- Docker & Docker Compose
- Node.js (v18+ recommended)

--> Run the Project

1. Clone the repository
2. Start all services:
   docker-compose up -d

3. Backend API:
   http://localhost:5000

4. Frontend:
   http://localhost:3000

5. Use seeded credentials or register a new tenant.

----------- API Overview ----------

-> Auth
POST /api/auth/register-tenant
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout

-> Tenants (SUPER_ADMIN)
GET  /api/tenants
GET  /api/tenants/:tenantId
PUT  /api/tenants/:tenantId

-> Users
POST /api/tenants/:tenantId/users
GET  /api/tenants/:tenantId/users
PUT  /api/users/:userId
DELETE /api/users/:userId

-> Projects
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PUT    /api/projects/:projectId
DELETE /api/projects/:projectId

-> Tasks
GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
PATCH  /api/tasks/:taskId/status
PUT    /api/tasks/:taskId
DELETE /api/tasks/:taskId

----------- Notes & Limitations ----------
- Email sending is not implemented
- UI styling is minimal and functionality-focused
- No refresh token mechanism (JWT access token only)
- Pagination is basic or limited
- Focus is correctness, security, and architecture over visuals

----------- What This Project Demonstrates ----------
- Real-world multi-tenant SaaS architecture
- Secure JWT-based authentication
- Proper RBAC enforcement
- Tenant data isolation
- Dockerized full-stack setup
- Practical debugging of production-style issues
- End-to-end system design thinking

This project was built to understand how real SaaS platforms are designed, secured, and debugged — not just how CRUD applications are written.
