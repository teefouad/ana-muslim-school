import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAdminFirestoreMock,
  collectionMock,
  whereMock,
  getMock,
  addMock,
  updateMock,
} = vi.hoisted(() => {
  const getMock = vi.fn();
  const limitMock = vi.fn(() => ({ get: getMock }));
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const addMock = vi.fn();
  const updateMock = vi.fn();
  const collectionMock = vi.fn(() => ({ where: whereMock, add: addMock }));
  const getAdminFirestoreMock = vi.fn(() => ({ collection: collectionMock }));

  return {
    getAdminFirestoreMock,
    collectionMock,
    whereMock,
    limitMock,
    getMock,
    addMock,
    updateMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

const { savePermissionRecord } = await import("./save-permission-record");

describe("savePermissionRecord", () => {
  const input = {
    email: "user@example.com",
    permissions: {
      books: { read: true, create: false, update: false, delete: false },
      users: { manage: false },
    },
    expiresAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new record when none exists for the normalized email", async () => {
    getMock.mockResolvedValueOnce({ empty: true, docs: [] });
    addMock.mockResolvedValueOnce({ id: "new-id" });

    const id = await savePermissionRecord(input, "admin@example.com");

    expect(id).toBe("new-id");
    expect(collectionMock).toHaveBeenCalledWith("permissions");
    expect(whereMock).toHaveBeenCalledWith("email", "==", "user@example.com");
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        permissions: input.permissions,
        expiresAt: null,
        createdBy: "admin@example.com",
        updatedBy: "admin@example.com",
        lastLoginAt: null,
      }),
    );
  });

  it("updates the existing record instead of creating a duplicate", async () => {
    getMock.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "existing-id", ref: { update: updateMock } }],
    });

    const id = await savePermissionRecord(input, "admin@example.com");

    expect(id).toBe("existing-id");
    expect(addMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        permissions: input.permissions,
        updatedBy: "admin@example.com",
      }),
    );
    // Must not resurrect creation metadata on an update.
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty("createdBy");
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty("createdAt");
  });
});
