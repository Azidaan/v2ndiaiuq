import { apiRequest } from "./apiClient";

export type AdminRole = "superadmin" | "admin" | "editor" | "viewer";
export type AdminPermission =
  | "content:read"
  | "content:write"
  | "content:delete"
  | "inquiries:read"
  | "inquiries:write"
  | "inquiries:delete"
  | "users:manage";

export interface AdminSession {
  user: {
    id: string;
    email: string;
    role: AdminRole;
    must_change_password: boolean;
  };
}

const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  superadmin: ["content:read", "content:write", "content:delete", "inquiries:read", "inquiries:write", "inquiries:delete", "users:manage"],
  admin: ["content:read", "content:write", "content:delete", "inquiries:read", "inquiries:write", "inquiries:delete"],
  editor: ["content:read", "content:write", "inquiries:read", "inquiries:write"],
  viewer: ["content:read", "inquiries:read"],
};

export const can = (role: AdminRole, permission: AdminPermission) =>
  rolePermissions[role].includes(permission);
const listeners = new Set<(session: AdminSession | null) => void>();
const notify = (session: AdminSession | null) => listeners.forEach((listener) => listener(session));

export const authService = {
  async getSession() {
    try {
      return await apiRequest<AdminSession>("/api/auth/session");
    } catch {
      return null;
    }
  },
  onChange(callback: (session: AdminSession | null) => void) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  async signIn(email: string, password: string) {
    const session = await apiRequest<AdminSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    notify(session);
  },
  async signOut() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    notify(null);
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await apiRequest("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const session = await this.getSession();
    notify(session);
  },
};
