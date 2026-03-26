# API Documentation
## Multi-Tenant SaaS Platform — All 19 Endpoints

Base URL: `http://localhost:5000/api`

Authentication: `Authorization: Bearer <jwt-token>` header required for protected endpoints.

All responses follow the format: `{ success: boolean, message?: string, data?: object }`

---

## Authentication

### API 1: Register Tenant
**POST** `/api/auth/register-tenant`  
Authentication: None (public)

**Request Body:**
```json
{
  "tenantName": "Test Company Alpha",
  "subdomain": "testalpha",
  "adminEmail": "admin@testalpha.com",
  "adminPassword": "TestPass@123",
  "adminFullName": "Alpha Admin"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Tenant registered successfully",
  "data": {
    "tenantId": "uuid",
    "subdomain": "testalpha",
    "adminUser": {
      "id": "uuid",
      "email": "admin@testalpha.com",
      "fullName": "Alpha Admin",
      "role": "tenant_admin"
    }
  }
}
```

**Errors:** 400 (validation), 409 (subdomain exists)

---

### API 2: Login
**POST** `/api/auth/login`  
Authentication: None (public)

**Request Body:**
```json
{
  "email": "admin@demo.com",
  "password": "Demo@123",
  "tenantSubdomain": "demo"
}
```
Super admin login (no subdomain):
```json
{ "email": "superadmin@system.com", "password": "Admin@123" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "admin@demo.com", "fullName": "Demo Admin", "role": "tenant_admin", "tenantId": "uuid" },
    "token": "eyJhbGci...",
    "expiresIn": 86400
  }
}
```

**Errors:** 401 (invalid credentials), 404 (tenant not found), 403 (suspended)

---

### API 3: Get Current User
**GET** `/api/auth/me`  
Authentication: Required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "email": "admin@demo.com", "fullName": "Demo Admin",
    "role": "tenant_admin", "isActive": true,
    "tenant": { "id": "uuid", "name": "Demo Company", "subdomain": "demo", "subscriptionPlan": "pro", "maxUsers": 25, "maxProjects": 15 }
  }
}
```

---

### API 4: Logout
**POST** `/api/auth/logout`  
Authentication: Required

**Response 200:**
```json
{ "success": true, "message": "Logged out successfully" }
```

---

## Tenant Management

### API 5: Get Tenant Details
**GET** `/api/tenants/:tenantId`  
Authentication: Required | Role: Same tenant or super_admin

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "name": "Demo Company", "subdomain": "demo",
    "status": "active", "subscriptionPlan": "pro", "maxUsers": 25, "maxProjects": 15,
    "createdAt": "2024-01-01T00:00:00Z",
    "stats": { "totalUsers": 4, "totalProjects": 2, "totalTasks": 5 }
  }
}
```

---

### API 6: Update Tenant
**PUT** `/api/tenants/:tenantId`  
Authentication: Required | Role: tenant_admin (name only), super_admin (all fields)

**Request Body:**
```json
{ "name": "Updated Company Name" }
```
Super admin can also send: `status`, `subscriptionPlan`, `maxUsers`, `maxProjects`

**Response 200:**
```json
{ "success": true, "message": "Tenant updated successfully", "data": { "id": "uuid", "name": "Updated Company Name", "updatedAt": "..." } }
```

---

### API 7: List All Tenants
**GET** `/api/tenants?page=1&limit=10&status=active&subscriptionPlan=pro`  
Authentication: Required | Role: super_admin only

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tenants": [{ "id": "uuid", "name": "Demo Company", "subdomain": "demo", "status": "active", "subscriptionPlan": "pro", "totalUsers": 4, "totalProjects": 2, "createdAt": "..." }],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalTenants": 1, "limit": 10 }
  }
}
```

**Errors:** 403 (not super_admin)

---

## User Management

### API 8: Add User to Tenant
**POST** `/api/tenants/:tenantId/users`  
Authentication: Required | Role: tenant_admin

**Request Body:**
```json
{ "email": "newuser@demo.com", "password": "NewUser@123", "fullName": "New User", "role": "user" }
```

**Response 201:**
```json
{
  "success": true, "message": "User created successfully",
  "data": { "id": "uuid", "email": "newuser@demo.com", "fullName": "New User", "role": "user", "tenantId": "uuid", "isActive": true, "createdAt": "..." }
}
```

**Errors:** 403 (limit reached), 409 (email exists in tenant)

---

### API 9: List Tenant Users
**GET** `/api/tenants/:tenantId/users?search=john&role=user&page=1&limit=50`  
Authentication: Required | Role: Same tenant

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": [{ "id": "uuid", "email": "user1@demo.com", "fullName": "User One", "role": "user", "isActive": true, "createdAt": "..." }],
    "total": 4,
    "pagination": { "currentPage": 1, "totalPages": 1, "limit": 50 }
  }
}
```

---

### API 10: Update User
**PUT** `/api/users/:userId`  
Authentication: Required | Role: Self (fullName only), tenant_admin (all fields)

**Request Body:**
```json
{ "fullName": "Updated Name", "role": "tenant_admin", "isActive": false }
```

**Response 200:**
```json
{ "success": true, "message": "User updated successfully", "data": { "id": "uuid", "fullName": "Updated Name", "role": "tenant_admin", "isActive": false, "updatedAt": "..." } }
```

---

### API 11: Delete User
**DELETE** `/api/users/:userId`  
Authentication: Required | Role: tenant_admin

**Response 200:**
```json
{ "success": true, "message": "User deleted successfully" }
```

**Errors:** 403 (deleting self or no permission), 404 (not found)

---

## Project Management

### API 12: Create Project
**POST** `/api/projects`  
Authentication: Required

**Request Body:**
```json
{ "name": "Website Redesign Project", "description": "Complete redesign of company website", "status": "active" }
```

**Response 201:**
```json
{
  "success": true,
  "data": { "id": "uuid", "tenantId": "uuid", "name": "Website Redesign Project", "description": "...", "status": "active", "createdBy": "uuid", "createdAt": "..." }
}
```

**Errors:** 403 (project limit reached)

---

### API 13: List Projects
**GET** `/api/projects?status=active&search=website&page=1&limit=20`  
Authentication: Required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "projects": [{ "id": "uuid", "name": "Website Redesign", "description": "...", "status": "active", "createdBy": { "id": "uuid", "fullName": "Demo Admin" }, "taskCount": 3, "completedTaskCount": 1, "createdAt": "..." }],
    "total": 2,
    "pagination": { "currentPage": 1, "totalPages": 1, "limit": 20 }
  }
}
```

---

### API 14: Update Project
**PUT** `/api/projects/:projectId`  
Authentication: Required | Role: tenant_admin or project creator

**Request Body:**
```json
{ "name": "Updated Project Name", "description": "Updated description", "status": "archived" }
```

**Response 200:**
```json
{ "success": true, "message": "Project updated successfully", "data": { "id": "uuid", "name": "Updated Project Name", "status": "archived", "updatedAt": "..." } }
```

---

### API 15: Delete Project
**DELETE** `/api/projects/:projectId`  
Authentication: Required | Role: tenant_admin or creator

**Response 200:**
```json
{ "success": true, "message": "Project deleted successfully" }
```

---

## Task Management

### API 16: Create Task
**POST** `/api/projects/:projectId/tasks`  
Authentication: Required

**Request Body:**
```json
{ "title": "Design homepage mockup", "description": "Create high-fidelity design", "priority": "high", "assignedTo": "user-uuid", "dueDate": "2024-07-15" }
```

**Response 201:**
```json
{
  "success": true,
  "data": { "id": "uuid", "projectId": "uuid", "tenantId": "uuid", "title": "Design homepage mockup", "status": "todo", "priority": "high", "assignedTo": "uuid", "dueDate": "2024-07-15", "createdAt": "..." }
}
```

---

### API 17: List Project Tasks
**GET** `/api/projects/:projectId/tasks?status=in_progress&priority=high&assignedTo=uuid&search=design&page=1&limit=50`  
Authentication: Required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tasks": [{ "id": "uuid", "title": "Design homepage mockup", "status": "in_progress", "priority": "high", "assignedTo": { "id": "uuid", "fullName": "User One", "email": "user1@demo.com" }, "dueDate": "2024-07-15", "createdAt": "..." }],
    "total": 3,
    "pagination": { "currentPage": 1, "totalPages": 1, "limit": 50 }
  }
}
```

---

### API 18: Update Task Status
**PATCH** `/api/tasks/:taskId/status`  
Authentication: Required | Role: Any tenant member

**Request Body:**
```json
{ "status": "completed" }
```

**Response 200:**
```json
{ "success": true, "data": { "id": "uuid", "status": "completed", "updatedAt": "..." } }
```

---

### API 19: Update Task
**PUT** `/api/tasks/:taskId`  
Authentication: Required

**Request Body:**
```json
{ "title": "Updated task title", "description": "Updated description", "status": "in_progress", "priority": "high", "assignedTo": "user-uuid", "dueDate": "2024-08-01" }
```

**Response 200:**
```json
{
  "success": true, "message": "Task updated successfully",
  "data": { "id": "uuid", "title": "Updated task title", "status": "in_progress", "priority": "high", "assignedTo": { "id": "uuid", "fullName": "User One", "email": "user1@demo.com" }, "dueDate": "2024-08-01", "updatedAt": "..." }
}
```

---

### System: Health Check
**GET** `/api/health`  
Authentication: None

**Response 200:**
```json
{ "status": "ok", "database": "connected", "timestamp": "2024-01-01T00:00:00Z" }
```
