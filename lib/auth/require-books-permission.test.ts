import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, getDashboardAccessMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getDashboardAccessMock: vi.fn(),
}));

vi.mock("./session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("./access", () => ({
  getDashboardAccess: getDashboardAccessMock,
}));

const { requireBooksPermission } = await import("./require-books-permission");

const permissions = {
  books: { read: true, create: false, update: true, delete: false },
  users: { manage: false },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requireBooksPermission", () => {
  it("returns 401 when there is no authenticated session", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const result = await requireBooksPermission("read");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
    expect(getDashboardAccessMock).not.toHaveBeenCalled();
  });

  it("returns 403 when there is no dashboard access resolved", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone@example.com",
    });
    getDashboardAccessMock.mockResolvedValueOnce(null);

    const result = await requireBooksPermission("read");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns 403 for a pending user", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone@example.com",
    });
    getDashboardAccessMock.mockResolvedValueOnce({ status: "pending" });

    const result = await requireBooksPermission("read");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns 403 for an expired user", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone@example.com",
    });
    getDashboardAccessMock.mockResolvedValueOnce({
      status: "expired",
      permission: { permissions },
    });

    const result = await requireBooksPermission("read");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("grants the super admin every action without checking permission flags", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    getDashboardAccessMock.mockResolvedValueOnce({ status: "super-admin" });

    const result = await requireBooksPermission("delete");

    expect(result).toEqual({ ok: true, actorEmail: "admin@example.com" });
  });

  it("grants an active user the action when the matching books flag is true", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone@example.com",
    });
    getDashboardAccessMock.mockResolvedValueOnce({
      status: "active",
      permission: { permissions },
    });

    const result = await requireBooksPermission("update");

    expect(result).toEqual({ ok: true, actorEmail: "someone@example.com" });
  });

  it("returns 403 for an active user whose matching books flag is false", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone@example.com",
    });
    getDashboardAccessMock.mockResolvedValueOnce({
      status: "active",
      permission: { permissions },
    });

    const result = await requireBooksPermission("delete");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});
