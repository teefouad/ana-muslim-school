import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addMock,
  updateMock,
  getMock,
  whereMock,
  limitMock,
  orderByMock,
  collectionMock,
} = vi.hoisted(() => {
  const addMock = vi.fn();
  const updateMock = vi.fn();
  const getMock = vi.fn();
  const limitMock = vi.fn(() => ({ get: getMock }));
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const orderByMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({
    add: addMock,
    where: whereMock,
    orderBy: orderByMock,
  }));

  return {
    addMock,
    updateMock,
    getMock,
    whereMock,
    limitMock,
    orderByMock,
    collectionMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({ collection: collectionMock }),
}));

const SERVER_TIMESTAMP_SENTINEL = Symbol("serverTimestamp");

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL },
  Timestamp: {
    fromDate: (date: Date) => ({
      toDate: () => date,
      __isTimestamp: true,
    }),
  },
}));

const { upsertPermission, listPermissions } =
  await import("./permissions-repository");

const permissions = {
  books: { read: true, create: false, update: false, delete: false },
  users: { manage: false },
};

describe("upsertPermission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    limitMock.mockReturnValue({ get: getMock });
    whereMock.mockReturnValue({ limit: limitMock });
    orderByMock.mockReturnValue({ get: getMock });
    collectionMock.mockReturnValue({
      add: addMock,
      where: whereMock,
      orderBy: orderByMock,
    });
  });

  it("creates a new record when no record exists for the email", async () => {
    getMock.mockResolvedValueOnce({ empty: true, docs: [] });

    await upsertPermission({
      email: "someone@example.com",
      permissions,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(whereMock).toHaveBeenCalledWith(
      "email",
      "==",
      "someone@example.com",
    );
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "someone@example.com",
        permissions,
        expiresAt: null,
        createdBy: "admin@example.com",
        updatedBy: "admin@example.com",
        lastLoginAt: null,
      }),
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates the existing record instead of creating a duplicate", async () => {
    getMock.mockResolvedValueOnce({
      empty: false,
      docs: [{ ref: { update: updateMock } }],
    });

    await upsertPermission({
      email: "someone@example.com",
      permissions,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions,
        expiresAt: null,
        updatedBy: "admin@example.com",
      }),
    );
    expect(addMock).not.toHaveBeenCalled();
  });

  it("converts a provided expiration date to a Firestore Timestamp", async () => {
    getMock.mockResolvedValueOnce({ empty: true, docs: [] });
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");

    await upsertPermission({
      email: "someone@example.com",
      permissions,
      expiresAt,
      actorEmail: "admin@example.com",
    });

    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: expect.objectContaining({ __isTimestamp: true }),
      }),
    );
  });
});

describe("listPermissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    limitMock.mockReturnValue({ get: getMock });
    whereMock.mockReturnValue({ limit: limitMock });
    orderByMock.mockReturnValue({ get: getMock });
    collectionMock.mockReturnValue({
      add: addMock,
      where: whereMock,
      orderBy: orderByMock,
    });
  });

  it("maps Firestore documents into permission records", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-06-01T00:00:00.000Z");

    getMock.mockResolvedValueOnce({
      docs: [
        {
          id: "doc-1",
          data: () => ({
            email: "someone@example.com",
            permissions,
            expiresAt: { toDate: () => expiresAt },
            createdAt: { toDate: () => createdAt },
            createdBy: "admin@example.com",
            updatedAt: { toDate: () => createdAt },
            updatedBy: "admin@example.com",
            lastLoginAt: null,
          }),
        },
      ],
    });

    const records = await listPermissions();

    expect(records).toEqual([
      {
        id: "doc-1",
        email: "someone@example.com",
        permissions,
        expiresAt,
        createdAt,
        createdBy: "admin@example.com",
        updatedAt: createdAt,
        updatedBy: "admin@example.com",
        lastLoginAt: null,
      },
    ]);
  });
});
