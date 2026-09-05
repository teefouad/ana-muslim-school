import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  getPermissionByIdMock,
  updatePermissionMock,
  deletePermissionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getPermissionByIdMock: vi.fn(),
  updatePermissionMock: vi.fn(),
  deletePermissionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
  isSuperAdminEmail: (email: string | null | undefined) =>
    email === "admin@example.com",
}));

vi.mock("@/lib/permissions/permissions-service", () => ({
  getPermissionById: getPermissionByIdMock,
  updatePermission: updatePermissionMock,
  deletePermission: deletePermissionMock,
}));

const { GET, PATCH, DELETE } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/permissions/doc-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest() {
  return new Request("http://localhost/api/v1/permissions/doc-1");
}

function deleteRequest() {
  return new Request("http://localhost/api/v1/permissions/doc-1", {
    method: "DELETE",
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/permissions/[id]", () => {
  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(getPermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(getPermissionByIdMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the service reports not-found", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    getPermissionByIdMock.mockResolvedValueOnce({
      ok: false,
      error: "not-found",
    });

    const response = await GET(getRequest(), context("missing"));

    expect(response.status).toBe(404);
  });

  it("returns 400 when the service reports an invalid id", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    getPermissionByIdMock.mockResolvedValueOnce({
      ok: false,
      error: "invalid-id",
    });

    const response = await GET(getRequest(), context("a/b"));

    expect(response.status).toBe(400);
  });

  it("returns the record from the service, wrapped in a data envelope", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    getPermissionByIdMock.mockResolvedValueOnce({
      ok: true,
      value: { id: "doc-1" },
    });

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: "doc-1" } });
    expect(getPermissionByIdMock).toHaveBeenCalledWith("doc-1");
  });
});

describe("PATCH /api/v1/permissions/[id]", () => {
  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await PATCH(jsonRequest({}), context("doc-1"));

    expect(response.status).toBe(403);
    expect(updatePermissionMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await PATCH(jsonRequest({}), context("doc-1"));

    expect(response.status).toBe(403);
    expect(updatePermissionMock).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid-id", 400, "Invalid record id."],
    ["invalid-expiration", 400, "Invalid expiration date."],
    ["not-found", 404, "Record not found."],
  ] as const)(
    "maps a %s service error to %d",
    async (error, status, message) => {
      getSessionUserMock.mockResolvedValueOnce({
        uid: "1",
        email: "admin@example.com",
      });
      updatePermissionMock.mockResolvedValueOnce({ ok: false, error });

      const response = await PATCH(jsonRequest({}), context("doc-1"));
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(body).toEqual({ error: message });
    },
  );

  it("updates by the id from the route, deriving the actor from the session and ignoring a spoofed updatedBy/email in the body", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    updatePermissionMock.mockResolvedValueOnce({ ok: true, value: undefined });

    const response = await PATCH(
      jsonRequest({
        email: "attacker@example.com",
        updatedBy: "spoofed@example.com",
        permissions: { books: { read: true } },
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
      context("doc-1"),
    );

    expect(response.status).toBe(200);
    expect(updatePermissionMock).toHaveBeenCalledWith({
      id: "doc-1",
      permissions: { books: { read: true } },
      expiresAt: "2030-01-01T00:00:00.000Z",
      actorEmail: "admin@example.com",
    });
  });
});

describe("DELETE /api/v1/permissions/[id]", () => {
  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(deletePermissionMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(deletePermissionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the service reports an invalid id", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    deletePermissionMock.mockResolvedValueOnce({
      ok: false,
      error: "invalid-id",
    });

    const response = await DELETE(deleteRequest(), context("a/b"));

    expect(response.status).toBe(400);
  });

  it("returns 404 when the record doesn't exist", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    deletePermissionMock.mockResolvedValueOnce({
      ok: false,
      error: "not-found",
    });

    const response = await DELETE(deleteRequest(), context("missing"));

    expect(response.status).toBe(404);
  });

  it("deletes the record by the id from the route", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    deletePermissionMock.mockResolvedValueOnce({ ok: true, value: undefined });

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(200);
    expect(deletePermissionMock).toHaveBeenCalledWith("doc-1");
  });
});
