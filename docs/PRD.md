# Product Requirements Document (PRD)
## Multi-Tenant SaaS Platform — Project & Task Management System

---

## 1. User Personas

### Persona 1: Super Admin (System Administrator)

**Role Description:** A system-level administrator employed by the SaaS company. Has unrestricted access to all tenant accounts, data, and configuration.

**Key Responsibilities:**
- Monitor overall system health and usage
- Manage tenant accounts (create, suspend, upgrade plans)
- Audit system-wide activity and security events
- Investigate reported issues across tenants

**Main Goals:**
- Maintain system uptime and data integrity
- Ensure fair usage and enforce subscription limits
- Quickly resolve tenant escalations

**Pain Points:**
- Lack of visibility into per-tenant usage makes capacity planning hard
- Cannot easily move a tenant between plans without downtime
- No bulk operations for managing multiple tenants at once

---

### Persona 2: Tenant Admin (Organization Administrator)

**Role Description:** The primary administrator within an organization's workspace. Responsible for managing their team, projects, and workspace settings.

**Key Responsibilities:**
- Invite and manage team members
- Create and oversee projects
- Monitor team progress and task completion
- Manage workspace settings within their plan limits

**Main Goals:**
- Onboard team members quickly
- Gain visibility into project and task status
- Stay within subscription limits while maximizing productivity
- Maintain organized, up-to-date project tracking

**Pain Points:**
- Manually tracking who is working on what across multiple projects
- Difficulty knowing when subscription limits will be hit
- No easy way to see overall team workload

---

### Persona 3: End User (Regular Team Member)

**Role Description:** A regular employee who uses the platform daily to manage and complete their assigned tasks.

**Key Responsibilities:**
- View and update tasks assigned to them
- Participate in projects
- Update task status as work progresses
- Collaborate with team members

**Main Goals:**
- Quickly see what tasks are assigned to them
- Update task status without friction
- Understand project context for their work
- Know deadlines and priorities clearly

**Pain Points:**
- Information scattered across emails and chat — no single source of truth
- Difficulty understanding which tasks are highest priority
- No clear view of what teammates are working on

---

## 2. Functional Requirements

### Authentication Module

**FR-001:** The system shall allow new tenants to register with an organization name, unique subdomain, admin email, admin full name, and password via `POST /api/auth/register-tenant`.

**FR-002:** The system shall create both the tenant record and the initial admin user within a single database transaction during registration, rolling back if either operation fails.

**FR-003:** The system shall allow users to log in using their email, password, and tenant subdomain via `POST /api/auth/login`, returning a JWT token with 24-hour expiry.

**FR-004:** The system shall allow super admin users to log in without a tenant subdomain.

**FR-005:** The system shall provide a `GET /api/auth/me` endpoint that returns the authenticated user's profile including tenant information.

**FR-006:** The system shall allow authenticated users to log out via `POST /api/auth/logout`, logging the event in audit_logs.

---

### Tenant Management Module

**FR-007:** The system shall allow super admins to list all tenants with pagination, filtering by status and subscription plan via `GET /api/tenants`.

**FR-008:** The system shall allow authenticated users to view their own tenant details including usage statistics (total users, projects, tasks) via `GET /api/tenants/:tenantId`.

**FR-009:** The system shall enforce that tenant admins can only update the tenant name, while super admins can update name, status, subscription plan, and resource limits via `PUT /api/tenants/:tenantId`.

**FR-010:** The system shall automatically update `max_users` and `max_projects` when a super admin changes a tenant's subscription plan.

---

### User Management Module

**FR-011:** The system shall allow tenant admins to invite new users to their workspace via `POST /api/tenants/:tenantId/users`, enforcing the tenant's `max_users` limit before creation.

**FR-012:** The system shall enforce email uniqueness per tenant — the same email address may exist in different tenants but not twice within the same tenant.

**FR-013:** The system shall allow tenant admins to list all users in their workspace with search (by name/email) and role filtering via `GET /api/tenants/:tenantId/users`.

**FR-014:** The system shall allow tenant admins to update user roles and active status, and allow users to update their own full name, via `PUT /api/users/:userId`.

**FR-015:** The system shall allow tenant admins to delete users from their workspace via `DELETE /api/users/:userId`, automatically unassigning the user from any tasks they were assigned to.

**FR-016:** The system shall prevent tenant admins from deleting their own account, returning a 403 error.

---

### Project Management Module

**FR-017:** The system shall allow authenticated users to create projects within their tenant via `POST /api/projects`, enforcing the tenant's `max_projects` limit.

**FR-018:** The system shall automatically associate newly created projects with the authenticated user's `tenantId` and `userId` from the JWT token, not from user-supplied values.

**FR-019:** The system shall allow users to list all projects in their tenant with filtering by status, search by name, and pagination via `GET /api/projects`.

**FR-020:** The system shall allow tenant admins and project creators to update project name, description, and status via `PUT /api/projects/:projectId`.

**FR-021:** The system shall allow tenant admins and project creators to delete projects via `DELETE /api/projects/:projectId`, cascading deletion to all associated tasks.

---

### Task Management Module

**FR-022:** The system shall allow authenticated users to create tasks within a project via `POST /api/projects/:projectId/tasks`, deriving `tenant_id` from the project record rather than the JWT token.

**FR-023:** The system shall validate that any user assigned to a task belongs to the same tenant as the project before creating or updating the task.

**FR-024:** The system shall allow users to list all tasks within a project with filtering by status, priority, assigned user, and search by title via `GET /api/projects/:projectId/tasks`.

**FR-025:** The system shall allow any tenant member to update a task's status via `PATCH /api/tasks/:taskId/status`.

**FR-026:** The system shall allow authenticated users to update all task fields including title, description, status, priority, assignment, and due date via `PUT /api/tasks/:taskId`.

---

### Subscription & Limits Module

**FR-027:** The system shall enforce three subscription plans with the following limits:
- Free: 5 max users, 3 max projects
- Pro: 25 max users, 15 max projects
- Enterprise: 100 max users, 50 max projects

**FR-028:** New tenants shall be created on the Free plan by default.

---

### System Module

**FR-029:** The system shall provide a `GET /api/health` endpoint returning `{"status": "ok", "database": "connected"}` when all services are healthy.

---

## 3. Non-Functional Requirements

**NFR-001 (Performance):** API response time shall be under 200ms for 90% of requests under normal load. Database queries on `tenant_id` indexed columns shall complete in under 50ms.

**NFR-002 (Security):** All passwords shall be hashed using bcrypt with a minimum of 10 salt rounds. JWT tokens shall expire after 24 hours. All database queries shall use parameterized statements to prevent SQL injection. HTTP security headers shall be set via Helmet.js.

**NFR-003 (Scalability):** The shared-schema multi-tenant architecture shall support a minimum of 1,000 concurrent tenants without schema changes. The system shall support a minimum of 100 concurrent users with horizontal scaling via Docker container replication.

**NFR-004 (Availability):** The application shall target 99% uptime. The Docker health check system shall automatically restart failed containers. Database connection pooling (max 20 connections) shall prevent connection exhaustion under load.

**NFR-005 (Usability):** The frontend shall be fully responsive and functional on screens as small as 320px width. All forms shall provide real-time client-side validation with clear error messages. Loading states shall be shown for all asynchronous operations. Empty states shall guide users to take action.

**NFR-006 (Maintainability):** The codebase shall follow a clear separation of concerns: routes, middleware, utilities, and configuration shall be in separate modules. Database migrations shall be versioned and run automatically on startup. All environment-specific configuration shall be in environment variables, not hardcoded.

**NFR-007 (Data Integrity):** All critical operations (tenant registration, user creation) shall use database transactions. Foreign key constraints with CASCADE delete shall ensure referential integrity. Composite unique constraints shall enforce email uniqueness per tenant.
