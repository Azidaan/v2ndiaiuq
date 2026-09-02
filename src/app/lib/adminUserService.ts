import { apiRequest } from "./apiClient";
import type { AdminRole } from "./authService";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export const adminUserService = {
  list() {
    return apiRequest<AdminUser[]>("/api/admin/users");
  },
  create(input: { email: string; password: string; role: AdminRole }) {
    return apiRequest<AdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: { role: AdminRole; is_active: boolean }) {
    return apiRequest<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  resetPassword(id: string, password: string) {
    return apiRequest(`/api/admin/users/${encodeURIComponent(id)}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    });
  },
  remove(id: string) {
    return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
