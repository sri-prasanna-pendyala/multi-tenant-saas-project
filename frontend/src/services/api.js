import axios from 'axios';

// In Docker: REACT_APP_API_URL is baked at build time.
// We default to localhost:5000 so the browser can always reach the backend.
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const registerTenant = (data) => api.post('/auth/register-tenant', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const logout = () => api.post('/auth/logout');

// Tenants
export const getTenants = (params) => api.get('/tenants', { params });
export const getTenant = (id) => api.get(`/tenants/${id}`);
export const updateTenant = (id, data) => api.put(`/tenants/${id}`, data);
export const getTenantUsers = (tenantId, params) => api.get(`/tenants/${tenantId}/users`, { params });
export const createUser = (tenantId, data) => api.post(`/tenants/${tenantId}/users`, data);

// Users
export const updateUser = (userId, data) => api.put(`/users/${userId}`, data);
export const deleteUser = (userId) => api.delete(`/users/${userId}`);

// Projects
export const getProjects = (params) => api.get('/projects', { params });
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);

// Tasks
export const getProjectTasks = (projectId, params) => api.get(`/projects/${projectId}/tasks`, { params });
export const createTask = (projectId, data) => api.post(`/projects/${projectId}/tasks`, data);
export const updateTask = (taskId, data) => api.put(`/tasks/${taskId}`, data);
export const updateTaskStatus = (taskId, status) => api.patch(`/tasks/${taskId}/status`, { status });
export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}`);

export default api;
