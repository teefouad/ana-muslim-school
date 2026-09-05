import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  upsertPermissionMock,
  updatePermissionByIdMock,
  deletePermissionByIdMock,
  getPermissionByIdMock,
  getPermissionForEmailMock,
  listPermissionsMock,
  recordPermissionLoginMock,
} = vi.hoisted(() => ({
  upsertPermissionMock: vi.fn(),
  updatePermissionByIdMock: vi.fn(),
  deletePermissionByIdMock: vi.fn(),
  getPermissionByIdMock: vi.fn(),
  getPermissionForEmailMock: vi.fn(),
  listPermissionsMock: vi.fn(),
  recordPermissionLoginMock: vi.fn(),
}));

vi.mock("./permissions-repository", () => ({
  upsertPermission: upsertPermissionMock,
  updatePermissionById: updatePermissionByIdMock,
  deletePermissionById: deletePermissionByIdMock,
  getPermissionById: getPermissionByIdMock,
  getPermissionForEmail: getPermissionForEmailMock,
  listPermissions: listPermissionsMock,
  recordPermissionLogin: recordPermissionLoginMock,
}));

const {
  createPermission,
  updatePermission,
  deletePermission,
  getPermissionById,
  getPermissionForEmail,
  listPermissions,
  recordPermissionLogin,
} = await import("./permissions-service");

const permissionsInput = {
  books: { read: true, create: false, update: true, delete: false },
  users: { manage: true },
};

const permissionRecord = {
  id: "doc-1",
  email: "someone@example.com",
  permissions: permissionsInput,
  expiresAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "admin@example.com",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedBy: "admin@example.com",
  lastLoginAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createPermission", () => {
  it("rejects a missing email without touching the repository", async () => {
    const result = await createPermission({
      email: undefined,
      permissions: permissionsInput,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: false, error: "missing-email" });
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const result = await createPermission({
      email: "not-an-email",
      permissions: permissionsInput,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: false, error: "invalid-email" });
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable expiration date", async () => {
    const result = await createPermission({
      email: "someone@example.com",
      permissions: permissionsInput,
      expiresAt: "not-a-date",
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: false, error: "invalid-expiration" });
    expect(upsertPermissionMock).not.toHaveBeenCalled();
  });

  it("normalizes the email and forwards the actor as given, ignoring nothing from the caller", async () => {
    const result = await createPermission({
      email: "  Someone@Example.com  ",
      permissions: permissionsInput,
      expiresAt: "2030-01-01T00:00:00.000Z",
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(upsertPermissionMock).toHaveBeenCalledWith({
      email: "someone@example.com",
      permissions: permissionsInput,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      actorEmail: "admin@example.com",
    });
  });

  it("treats a truthy non-boolean permission value as false, not true", async () => {
    await createPermission({
      email: "someone@example.com",
      permissions: {
        books: { read: "false", create: 1, update: "yes", delete: [] },
        users: { manage: "0" },
      },
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(upsertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: {
          books: { read: false, create: false, update: false, delete: false },
          users: { manage: false },
        },
      }),
    );
  });

  it("treats a missing expiration as no expiration", async () => {
    await createPermission({
      email: "someone@example.com",
      permissions: permissionsInput,
      expiresAt: undefined,
      actorEmail: "admin@example.com",
    });

    expect(upsertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });
});

describe("updatePermission", () => {
  it("rejects an id containing a slash, which Firestore's .doc() would otherwise treat as a nested sub-path", async () => {
    const result = await updatePermission({
      id: "a/b",
      permissions: permissionsInput,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: false, error: "invalid-id" });
    expect(updatePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable expiration date", async () => {
    const result = await updatePermission({
      id: "doc-1",
      permissions: permissionsInput,
      expiresAt: "not-a-date",
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: false, error: "invalid-expiration" });
    expect(updatePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("reports not-found when the repository finds no matching document", async () => {
    updatePermissionByIdMock.mockResolvedValueOnce(false);

    const result = await updatePermission({
      id: "missing-doc",
      permissions: permissionsInput,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: false, error: "not-found" });
  });

  it("updates by id, deriving the actor from the caller-supplied value", async () => {
    updatePermissionByIdMock.mockResolvedValueOnce(true);

    const result = await updatePermission({
      id: "doc-1",
      permissions: permissionsInput,
      expiresAt: "2030-01-01T00:00:00.000Z",
      actorEmail: "admin@example.com",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(updatePermissionByIdMock).toHaveBeenCalledWith({
      id: "doc-1",
      permissions: permissionsInput,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      actorEmail: "admin@example.com",
    });
  });
});

describe("deletePermission", () => {
  it("rejects an id containing a slash", async () => {
    const result = await deletePermission("a/b");

    expect(result).toEqual({ ok: false, error: "invalid-id" });
    expect(deletePermissionByIdMock).not.toHaveBeenCalled();
  });

  it("reports not-found when the repository finds no matching document", async () => {
    deletePermissionByIdMock.mockResolvedValueOnce(false);

    expect(await deletePermission("missing-doc")).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("deletes by id", async () => {
    deletePermissionByIdMock.mockResolvedValueOnce(true);

    expect(await deletePermission("doc-1")).toEqual({
      ok: true,
      value: undefined,
    });
    expect(deletePermissionByIdMock).toHaveBeenCalledWith("doc-1");
  });
});

describe("getPermissionById", () => {
  it("rejects an id containing a slash without querying the repository", async () => {
    const result = await getPermissionById("a/b");

    expect(result).toEqual({ ok: false, error: "invalid-id" });
    expect(getPermissionByIdMock).not.toHaveBeenCalled();
  });

  it("reports not-found when the repository returns no record", async () => {
    getPermissionByIdMock.mockResolvedValueOnce(null);

    expect(await getPermissionById("missing-doc")).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("returns the record from the repository", async () => {
    getPermissionByIdMock.mockResolvedValueOnce(permissionRecord);

    expect(await getPermissionById("doc-1")).toEqual({
      ok: true,
      value: permissionRecord,
    });
  });
});

describe("getPermissionForEmail", () => {
  it("normalizes the email before delegating to the repository", async () => {
    getPermissionForEmailMock.mockResolvedValueOnce(permissionRecord);

    const result = await getPermissionForEmail("  Someone@Example.com  ");

    expect(getPermissionForEmailMock).toHaveBeenCalledWith(
      "someone@example.com",
    );
    expect(result).toBe(permissionRecord);
  });
});

describe("listPermissions", () => {
  it("delegates to the repository", async () => {
    listPermissionsMock.mockResolvedValueOnce([permissionRecord]);

    expect(await listPermissions()).toEqual([permissionRecord]);
  });
});

describe("recordPermissionLogin", () => {
  it("delegates to the repository", async () => {
    await recordPermissionLogin("doc-1");

    expect(recordPermissionLoginMock).toHaveBeenCalledWith("doc-1");
  });
});
