import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isSuperAdminEmail } from "./is-super-admin-email";

describe("isSuperAdminEmail", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAIL;

  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAIL = "admin@example.com";
  });

  afterEach(() => {
    process.env.SUPER_ADMIN_EMAIL = originalEnv;
  });

  it("matches the configured super-admin email", () => {
    expect(isSuperAdminEmail("admin@example.com")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isSuperAdminEmail("Admin@Example.com")).toBe(true);
  });

  it("rejects any other email", () => {
    expect(isSuperAdminEmail("someone-else@example.com")).toBe(false);
  });

  it("rejects null/undefined emails", () => {
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });

  it("rejects everyone when no super-admin email is configured", () => {
    process.env.SUPER_ADMIN_EMAIL = "";
    expect(isSuperAdminEmail("admin@example.com")).toBe(false);
  });
});
