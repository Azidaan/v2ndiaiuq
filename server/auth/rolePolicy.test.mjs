import { describe, expect, it } from "vitest";
import { Permissions, RolePolicy, Roles } from "./rolePolicy.mjs";

describe("RolePolicy", () => {
  const policy = new RolePolicy();

  it("allows only a superadmin to manage users", () => {
    expect(policy.can(Roles.SUPERADMIN, Permissions.USERS_MANAGE)).toBe(true);
    expect(policy.can(Roles.ADMIN, Permissions.USERS_MANAGE)).toBe(false);
  });

  it("does not allow an editor or viewer to delete content", () => {
    expect(policy.can(Roles.EDITOR, Permissions.CONTENT_DELETE)).toBe(false);
    expect(policy.can(Roles.VIEWER, Permissions.CONTENT_DELETE)).toBe(false);
  });

  it("gives a viewer read-only access", () => {
    expect(policy.can(Roles.VIEWER, Permissions.CONTENT_READ)).toBe(true);
    expect(policy.can(Roles.VIEWER, Permissions.CONTENT_WRITE)).toBe(false);
    expect(policy.can(Roles.VIEWER, Permissions.INQUIRIES_READ)).toBe(true);
    expect(policy.can(Roles.VIEWER, Permissions.INQUIRIES_WRITE)).toBe(false);
  });

  it("allows administrators to manage inquiries and editors to process them", () => {
    expect(policy.can(Roles.ADMIN, Permissions.INQUIRIES_DELETE)).toBe(true);
    expect(policy.can(Roles.EDITOR, Permissions.INQUIRIES_WRITE)).toBe(true);
    expect(policy.can(Roles.EDITOR, Permissions.INQUIRIES_DELETE)).toBe(false);
  });
});
