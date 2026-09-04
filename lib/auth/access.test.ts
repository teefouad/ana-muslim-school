import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getPermissionForEmailMock } = vi.hoisted(() => ({
  getPermissionForEmailMock: vi.fn(),
}));

vi.mock("@/lib/permissions/permissions-repository", () => ({
  getPermissionForEmail: getPermissionForEmailMock,
}));

const { resolveDashboardAccess } = await import("./access");

const permissions = {
  books: { read: true, create: false, update: false, delete: false },
  users: { manage: false },
};

function permissionRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "doc-1",
    email: "someone@example.com",
    permissions,
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedBy: "admin@example.com",
    lastLoginAt: null,
    ...overrides,
  };
}

describe("resolveDashboardAccess", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAIL;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SUPER_ADMIN_EMAIL = "admin@example.com";
  });

  afterEach(() => {
    process.env.SUPER_ADMIN_EMAIL = originalEnv;
  });

  it("grants access to the configured super admin without a permission record", async () => {
    const access = await resolveDashboardAccess({
      uid: "1",
      email: "admin@example.com",
    });

    expect(access).toEqual({ status: "super-admin" });
    expect(getPermissionForEmailMock).not.toHaveBeenCalled();
  });

  it("normalizes the email before looking up the permission record", async () => {
    getPermissionForEmailMock.mockResolvedValueOnce(null);

    await resolveDashboardAccess({
      uid: "2",
      email: "  Someone@Example.com  ",
    });

    expect(getPermissionForEmailMock).toHaveBeenCalledWith(
      "someone@example.com",
    );
  });

  it("marks a user pending when no permission record exists", async () => {
    getPermissionForEmailMock.mockResolvedValueOnce(null);

    const access = await resolveDashboardAccess({
      uid: "2",
      email: "someone@example.com",
    });

    expect(access).toEqual({ status: "pending" });
  });

  it("grants access when the permission record has no expiration", async () => {
    const permission = permissionRecord({ expiresAt: null });
    getPermissionForEmailMock.mockResolvedValueOnce(permission);

    const access = await resolveDashboardAccess({
      uid: "2",
      email: "someone@example.com",
    });

    expect(access).toEqual({ status: "active", permission });
  });

  it("grants access when the permission record expires in the future", async () => {
    const permission = permissionRecord({
      expiresAt: new Date(Date.now() + 60_000),
    });
    getPermissionForEmailMock.mockResolvedValueOnce(permission);

    const access = await resolveDashboardAccess({
      uid: "2",
      email: "someone@example.com",
    });

    expect(access).toEqual({ status: "active", permission });
  });

  it("denies access when the permission record expired in the past", async () => {
    const permission = permissionRecord({
      expiresAt: new Date(Date.now() - 60_000),
    });
    getPermissionForEmailMock.mockResolvedValueOnce(permission);

    const access = await resolveDashboardAccess({
      uid: "2",
      email: "someone@example.com",
    });

    expect(access).toEqual({ status: "expired", permission });
  });
});
