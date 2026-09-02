import { describe, expect, it, vi } from "vitest";
import { RolePolicy } from "../auth/rolePolicy.mjs";
import { AdminUserService } from "./adminUserService.mjs";

function serviceWith(repository) {
  return new AdminUserService({
    repository,
    rolePolicy: new RolePolicy(),
    passwordHasher: {
      hash: vi.fn(async (value) => `hash:${value}`),
      verify: vi.fn(async (value, hash) => hash === `hash:${value}`),
    },
  });
}

describe("AdminUserService", () => {
  it("normalizes an email and hashes a temporary password", async () => {
    const repository = {
      create: vi.fn(async (input) => input),
    };
    const result = await serviceWith(repository).create({
      email: " Editor@Example.RU ",
      password: "temporary-pass",
      role: "editor",
    });
    expect(result).toMatchObject({ email: "editor@example.ru", passwordHash: "hash:temporary-pass", role: "editor" });
  });

  it("protects the last active superadmin from demotion", async () => {
    const repository = {
      findById: vi.fn(async () => ({ id: "root", role: "superadmin", is_active: true })),
      countActiveSuperadmins: vi.fn(async () => 1),
    };
    await expect(serviceWith(repository).update("root", { role: "admin", is_active: true }, "other"))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not allow a user to delete their own account", async () => {
    await expect(serviceWith({}).remove("root", "root")).rejects.toMatchObject({ statusCode: 409 });
  });
});
