import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  updatePermissionByIdMock,
  deletePermissionByIdMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  updatePermissionByIdMock: vi.fn(),
  deletePermissionByIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
  isSuperAdminEmail: (email: string | null | undefined) =>
    email === "admin@example.com",
}));

vi.mock("@/lib/permissions/permissions-repository", () => ({
  updatePermissionById: updatePermissionByIdMock,
  deletePermissionById: deletePermissionByIdMock,
}));

const { PATCH, DELETE } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/permissions/doc-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request("http://localhost/api/permissions/doc-1", {
    method: "DELETE",
  });
}

function patchContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/permissions/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await PATCH(jsonRequest({}), patchContext("doc-1"));

    expect(response.status).toBe(403);
    expect(updatePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await PATCH(jsonRequest({}), patchContext("doc-1"));

    expect(response.status).toBe(403);
    expect(updatePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects an id containing a slash, which Firestore's .doc() would otherwise treat as a nested sub-path", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    const response = await PATCH(jsonRequest({}), patchContext("a/b"));

    expect(response.status).toBe(400);
    expect(updatePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable expiration date", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    const response = await PATCH(
      jsonRequest({ expiresAt: "not-a-date" }),
      patchContext("doc-1"),
    );

    expect(response.status).toBe(400);
    expect(updatePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the record doesn't exist", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    updatePermissionByIdMock.mockResolvedValueOnce(false);

    const response = await PATCH(jsonRequest({}), patchContext("missing"));

    expect(response.status).toBe(404);
  });

  it("updates by the id from the route, deriving the actor from the session and ignoring a spoofed updatedBy/email in the body", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    updatePermissionByIdMock.mockResolvedValueOnce(true);

    const response = await PATCH(
      jsonRequest({
        email: "attacker@example.com",
        updatedBy: "spoofed@example.com",
        permissions: {
          books: { read: true, create: false, update: true, delete: false },
          users: { manage: true },
        },
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
      patchContext("doc-1"),
    );

    expect(response.status).toBe(200);
    expect(updatePermissionByIdMock).toHaveBeenCalledWith({
      id: "doc-1",
      permissions: {
        books: { read: true, create: false, update: true, delete: false },
        users: { manage: true },
      },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      actorEmail: "admin@example.com",
    });
  });

  it("treats a missing expiration as no expiration", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    updatePermissionByIdMock.mockResolvedValueOnce(true);

    await PATCH(jsonRequest({}), patchContext("doc-1"));

    expect(updatePermissionByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });
});

describe("DELETE /api/permissions/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await DELETE(deleteRequest(), patchContext("doc-1"));

    expect(response.status).toBe(403);
    expect(deletePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await DELETE(deleteRequest(), patchContext("doc-1"));

    expect(response.status).toBe(403);
    expect(deletePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects an id containing a slash", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    const response = await DELETE(deleteRequest(), patchContext("a/b"));

    expect(response.status).toBe(400);
    expect(deletePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the record doesn't exist", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    deletePermissionByIdMock.mockResolvedValueOnce(false);

    const response = await DELETE(deleteRequest(), patchContext("missing"));

    expect(response.status).toBe(404);
  });

  it("deletes the record by the id from the route", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    deletePermissionByIdMock.mockResolvedValueOnce(true);

    const response = await DELETE(deleteRequest(), patchContext("doc-1"));

    expect(response.status).toBe(200);
    expect(deletePermissionByIdMock).toHaveBeenCalledWith("doc-1");
  });
});
