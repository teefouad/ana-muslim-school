import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, upsertPermissionMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  upsertPermissionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
  isSuperAdminEmail: (email: string | null | undefined) =>
    email === "admin@example.com",
}));

vi.mock("@/lib/permissions/permissions-repository", () => ({
  upsertPermission: upsertPermissionMock,
}));

const { POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/permissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await POST(jsonRequest({ email: "someone@example.com" }));

    expect(response.status).toBe(403);
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await POST(jsonRequest({ email: "someone@example.com" }));

    expect(response.status).toBe(403);
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    const response = await POST(jsonRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable expiration date", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    const response = await POST(
      jsonRequest({ email: "someone@example.com", expiresAt: "not-a-date" }),
    );

    expect(response.status).toBe(400);
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("normalizes the email and derives the actor from the session, not the request body", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    const response = await POST(
      jsonRequest({
        email: "  Someone@Example.com  ",
        createdBy: "spoofed@example.com",
        permissions: {
          books: { read: true, create: false, update: true, delete: false },
          users: { manage: true },
        },
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertPermissionMock).toHaveBeenCalledWith({
      email: "someone@example.com",
      permissions: {
        books: { read: true, create: false, update: true, delete: false },
        users: { manage: true },
      },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      actorEmail: "admin@example.com",
    });
  });

  it("parses the DateTimePicker's 'YYYY-MM-DD HH:mm:ss' value", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    await POST(
      jsonRequest({
        email: "someone@example.com",
        expiresAt: "2030-01-01 10:30:00",
      }),
    );

    expect(upsertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date(2030, 0, 1, 10, 30, 0),
      }),
    );
  });

  it("treats a missing expiration as no expiration", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });

    await POST(jsonRequest({ email: "someone@example.com" }));

    expect(upsertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });
});
