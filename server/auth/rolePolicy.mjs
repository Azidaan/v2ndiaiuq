export const Roles = Object.freeze({
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
});

export const Permissions = Object.freeze({
  CONTENT_READ: "content:read",
  CONTENT_WRITE: "content:write",
  CONTENT_DELETE: "content:delete",
  INQUIRIES_READ: "inquiries:read",
  INQUIRIES_WRITE: "inquiries:write",
  INQUIRIES_DELETE: "inquiries:delete",
  USERS_MANAGE: "users:manage",
});

const rolePermissions = Object.freeze({
  [Roles.SUPERADMIN]: new Set(Object.values(Permissions)),
  [Roles.ADMIN]: new Set([
    Permissions.CONTENT_READ,
    Permissions.CONTENT_WRITE,
    Permissions.CONTENT_DELETE,
    Permissions.INQUIRIES_READ,
    Permissions.INQUIRIES_WRITE,
    Permissions.INQUIRIES_DELETE,
  ]),
  [Roles.EDITOR]: new Set([
    Permissions.CONTENT_READ,
    Permissions.CONTENT_WRITE,
    Permissions.INQUIRIES_READ,
    Permissions.INQUIRIES_WRITE,
  ]),
  [Roles.VIEWER]: new Set([Permissions.CONTENT_READ, Permissions.INQUIRIES_READ]),
});

export class RolePolicy {
  isRole(role) {
    return Object.hasOwn(rolePermissions, role);
  }

  can(role, permission) {
    return rolePermissions[role]?.has(permission) ?? false;
  }
}
