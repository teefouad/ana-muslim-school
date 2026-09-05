import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, createPermissionMock, listPermissionsMock } =
  vi.hoisted(() => ({
    getSessionUserMock: vi.fn(),
    createPermissionMock: vi.fn(),
    listPermissionsMock: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
  isSuperAdminEmail: (email: string | null | undefined) =>
    email === "admin@example.com",
}));

vi.mock("@/lib/permissions/permissions-service", () => ({
  createPermission: createPermissionMock,
  listPermissions: listPermissionsMock,
}));

const { GET, POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/permissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/permissions", () => {
  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listPermissionsMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listPermissionsMock).not.toHaveBeenCalled();
  });

  it("returns the records from the service, wrapped in a data envelope", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    listPermissionsMock.mockResolvedValueOnce([{ id: "doc-1" }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [{ id: "doc-1" }] });
  });
});

describe("POST /api/v1/permissions", () => {
  it("rejects unauthenticated requests", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);

    const response = await POST(jsonRequest({ email: "someone@example.com" }));

    expect(response.status).toBe(403);
    expect(createPermissionMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an authenticated non-super-admin", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });

    const response = await POST(jsonRequest({ email: "someone@example.com" }));

    expect(response.status).toBe(403);
    expect(createPermissionMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing-email", 400, "Email is required."],
    ["invalid-email", 400, "Enter a valid email address."],
    ["invalid-expiration", 400, "Invalid expiration date."],
  ] as const)(
    "maps a %s service error to %d",
    async (error, status, message) => {
      getSessionUserMock.mockResolvedValueOnce({
        uid: "1",
        email: "admin@example.com",
      });
      createPermissionMock.mockResolvedValueOnce({ ok: false, error });

      const response = await POST(
        jsonRequest({ email: "someone@example.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(body).toEqual({ error: message });
    },
  );

  it("derives the actor from the session and forwards the raw body to the service", async () => {
    getSessionUserMock.mockResolvedValueOnce({
      uid: "1",
      email: "admin@example.com",
    });
    createPermissionMock.mockResolvedValueOnce({ ok: true, value: undefined });

    const response = await POST(
      jsonRequest({
        email: "  Someone@Example.com  ",
        createdBy: "spoofed@example.com",
        permissions: { books: { read: true } },
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(createPermissionMock).toHaveBeenCalledWith({
      email: "  Someone@Example.com  ",
      permissions: { books: { read: true } },
      expiresAt: "2030-01-01T00:00:00.000Z",
      actorEmail: "admin@example.com",
    });
  });
});
