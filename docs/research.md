# Research Document: Multi-Tenant SaaS Platform

## 1. Multi-Tenancy Analysis

### Overview

Multi-tenancy is an architectural pattern where a single instance of an application serves multiple customers (tenants), with each tenant's data isolated from others. There are three primary approaches to implementing multi-tenancy in relational databases:

---

### Approach 1: Shared Database + Shared Schema (tenant_id column)

All tenants share the same database and the same tables. Every row includes a `tenant_id` column that identifies which tenant it belongs to.

**Pros:**
- Simplest to implement and maintain
- Low infrastructure cost — one database for all tenants
- Easy to add new tenants (just insert a tenant record)
- Efficient use of resources at scale
- Schema migrations are applied once for all tenants
- Straightforward querying with WHERE tenant_id = ?

**Cons:**
- Risk of data leakage if tenant_id filtering is missed in queries
- Noisy neighbor problem — one tenant's heavy queries affect others
- Harder to give per-tenant database customization
- Backup/restore of a single tenant's data is complex
- Compliance (GDPR) may require more careful design

**Best for:** SaaS startups, B2B products with many SMB customers, cost-sensitive applications

---

### Approach 2: Shared Database + Separate Schema (per tenant)

All tenants share one database instance but each has its own schema (namespace). Tables are prefixed or namespaced per tenant (e.g., `tenant_acme.users`).

**Pros:**
- Better logical isolation than shared schema
- Schema can be customized per tenant
- Easier per-tenant backup and restore
- Slightly better security than shared schema

**Cons:**
- Schema migrations must be applied to every tenant schema separately
- Number of schemas can grow very large (thousands of tenants = thousands of schemas)
- More complex application code for routing queries to correct schema
- Higher DBA overhead
- Most databases have limits on number of schemas/tables

**Best for:** Mid-market SaaS with moderate tenant counts, products requiring some per-tenant customization

---

### Approach 3: Separate Database (per tenant)

Each tenant gets their own dedicated database instance.

**Pros:**
- Maximum isolation — no shared resources
- Full customization per tenant
- Easy per-tenant backup/restore/migration
- Compliance-friendly (data residency, GDPR right to erasure)
- One tenant's performance issues don't affect others

**Cons:**
- Extremely high infrastructure cost
- Complex connection pooling (thousands of database connections)
- Schema migrations are complex and slow (must run against each DB)
- Onboarding new tenants requires provisioning a new database
- Monitoring and operations complexity grows linearly with tenant count

**Best for:** Enterprise-tier customers, regulated industries (healthcare, finance), products with very large per-tenant data volumes

---

### Comparison Table

| Factor | Shared Schema | Separate Schema | Separate Database |
|---|---|---|---|
| Data Isolation | Low-Medium | Medium | High |
| Implementation Complexity | Low | Medium | High |
| Infrastructure Cost | Low | Medium | High |
| Scalability (tenant count) | Very High | High | Low |
| Schema Migrations | Easy | Complex | Very Complex |
| Per-tenant Customization | None | Limited | Full |
| Backup per tenant | Hard | Medium | Easy |
| Compliance | Requires care | Moderate | Best |
| Onboarding Speed | Instant | Fast | Slow |
| Recommended tenant count | 1000s | 100s | 10s |

---

### Chosen Approach: Shared Database + Shared Schema

**Justification:** For this project, we selected the shared database with shared schema approach for the following reasons:

1. **Simplicity and speed of development:** The single schema approach allows us to build and iterate quickly without complex infrastructure.
2. **Cost efficiency:** A single PostgreSQL instance serves all tenants, minimizing operational cost.
3. **Tenant scale:** This SaaS platform is designed for potentially thousands of tenants, which would make separate databases prohibitively expensive.
4. **Proven pattern:** This is the approach used by major SaaS platforms including GitHub, Shopify (early), and Basecamp.
5. **Security via application layer:** We implement strict tenant isolation at the application layer, ensuring every query is filtered by `tenant_id` extracted from the JWT token rather than from user input.

---

## 2. Technology Stack Justification

### Backend: Node.js + Express.js

**Chosen:** Node.js 18 LTS with Express.js 4.x

**Why Node.js:**
- Non-blocking I/O makes it ideal for API servers that handle many concurrent requests
- JavaScript on both frontend and backend reduces context-switching for developers
- Massive npm ecosystem with well-maintained packages for JWT, bcrypt, PostgreSQL
- Excellent performance for I/O-bound workloads (which most SaaS APIs are)
- Fast startup time, important for containerized deployments

**Why Express.js:**
- Minimal, unopinionated framework that gives full control
- Battle-tested with millions of production deployments
- Middleware ecosystem (CORS, Helmet, Morgan) is mature and reliable
- Easy to structure routes, controllers, and middleware
- Simple to add validation, authentication, and error handling

**Alternatives considered:**
- **Fastify:** Slightly faster than Express but smaller community and ecosystem
- **NestJS:** More opinionated, great for large teams but adds complexity for this scope
- **Python/FastAPI:** Excellent choice but JavaScript was preferred for stack consistency
- **Go/Gin:** Best raw performance but longer development time and less npm ecosystem

---

### Frontend: React.js

**Chosen:** React 18 with React Router v6

**Why React:**
- Component-based architecture maps perfectly to the UI requirements (modals, tables, forms)
- Largest frontend ecosystem with abundant UI libraries
- React hooks (useState, useEffect, useContext) provide clean state management without Redux overhead
- React Router v6 provides simple protected route implementation
- Context API is sufficient for authentication state management at this scale

**Alternatives considered:**
- **Vue.js:** Excellent framework but smaller job market and ecosystem
- **Next.js:** Great for SSR but adds complexity not needed for a SPA
- **Svelte:** Excellent performance but smaller community, fewer libraries

---

### Database: PostgreSQL 15

**Chosen:** PostgreSQL 15

**Why PostgreSQL:**
- ACID compliance is essential for financial/subscription data and user management
- Excellent support for UUIDs as primary keys
- Rich constraint system: UNIQUE(tenant_id, email) composite constraints work perfectly
- ENUM types map cleanly to our status/role/plan fields
- Excellent performance with proper indexing on tenant_id columns
- pg (node-postgres) driver is mature and well-maintained
- Full support for transactions, essential for tenant registration atomicity
- CASCADE delete behavior handles our relational cleanup automatically
- Native JSON support for flexible audit log metadata if needed

**Alternatives considered:**
- **MySQL:** Good alternative but PostgreSQL has better constraint support and standards compliance
- **MongoDB:** Document database doesn't align well with our strongly relational data model (users belong to tenants, tasks belong to projects and tenants)
- **SQLite:** Not suitable for multi-user production workloads

---

### Authentication: JWT (JSON Web Tokens)

**Chosen:** JWT with 24-hour expiry, signed with HS256

**Why JWT:**
- Stateless — no session storage needed, scales horizontally without shared session store
- Payload carries userId, tenantId, and role — all we need for authorization
- 24-hour expiry balances security with usability
- Works seamlessly across Docker containers without shared state
- Well-supported by jsonwebtoken npm package

**Alternatives considered:**
- **Session cookies:** Require server-side session storage, complicates horizontal scaling
- **OAuth2/OIDC:** Overkill for this internal authentication system; would add complexity without benefit

---

### Containerization: Docker + Docker Compose

**Chosen:** Docker with multi-service Docker Compose

**Why Docker:**
- Guarantees consistent environment across development, testing, and production
- Single command deployment: `docker-compose up -d`
- Service isolation with named services (database, backend, frontend)
- Health checks ensure services only accept traffic when ready
- Volume persistence for PostgreSQL data

---

## 3. Security Considerations

### 1. Tenant Data Isolation

The most critical security concern in a multi-tenant system is preventing cross-tenant data access. Our strategy:

- **JWT-based tenant identification:** Every authenticated request includes a JWT containing `tenantId`. The application extracts this from the token, not from user input.
- **Query-level enforcement:** Every database query that accesses tenant-specific data includes `WHERE tenant_id = $tenantId` using parameterized queries.
- **Middleware enforcement:** Authentication middleware validates the JWT and attaches `req.user` (including `tenantId`) before any route handler runs.
- **Super admin exception:** Super admin users have `tenantId = null` in their JWT and bypass tenant filtering, but must explicitly target a specific tenant.

### 2. Password Security

- Passwords are hashed using **bcryptjs** with 12 salt rounds — this is strong enough to resist GPU-based brute-force attacks
- Plain-text passwords are never stored, logged, or returned in API responses
- Password comparison uses `bcrypt.compare()`, which is timing-safe and resistant to timing attacks
- Minimum password length of 8 characters is enforced at both API and frontend levels

### 3. API Security (Input Validation + SQL Injection Prevention)

- All database queries use **parameterized queries** (prepared statements via node-postgres) — this completely prevents SQL injection
- Input validation checks required fields, email format, password strength, and enum values before any database operation
- Subdomain validation uses a strict regex: `/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/`
- HTTP security headers are set via **Helmet.js** (X-Content-Type-Options, X-Frame-Options, CSP, etc.)

### 4. Authorization (Role-Based Access Control)

- Three roles with strictly enforced permissions: `super_admin`, `tenant_admin`, `user`
- Authorization is enforced at the **route level** via middleware, not just the frontend
- Tenant admins cannot update subscription plans or tenant status (server returns 403)
- Regular users cannot delete other users or manage roles
- Cross-tenant access is blocked: a tenant admin of tenant A cannot access tenant B's data even with a valid JWT

### 5. Audit Logging

- All CREATE, UPDATE, DELETE operations are logged to the `audit_logs` table
- Each log entry includes: `tenant_id`, `user_id`, `action` (e.g., CREATE_USER), `entity_type`, `entity_id`, and `ip_address`
- Login and logout events are also logged
- Audit logs use CASCADE delete from tenants but user_id is SET NULL on user deletion to preserve the audit trail
- This provides a complete security audit trail for compliance and incident response

### Additional Measures

- **CORS:** Configured to only allow requests from the known frontend origin (configurable via `FRONTEND_URL` environment variable)
- **Environment variables:** All secrets (JWT secret, database password) are stored in environment variables, never hardcoded
- **Token expiry:** JWTs expire after 24 hours; the frontend detects 401 responses and redirects to login
- **No sensitive data in tokens:** JWT payload contains only `userId`, `tenantId`, and `role` — never passwords or PII
