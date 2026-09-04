import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMock,
  whereMock,
  orderByMock,
  setMock,
  docMock,
  addMock,
  collectionMock,
  serverTimestampMock,
  fromDateMock,
} = vi.hoisted(() => {
  const getMock = vi.fn();
  const limitMock = vi.fn(() => ({ get: getMock }));
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const orderByMock = vi.fn(() => ({ get: getMock }));
  const setMock = vi.fn();
  const docMock = vi.fn(() => ({ set: setMock }));
  const addMock = vi.fn();
  const collectionMock = vi.fn(() => ({
    where: whereMock,
    orderBy: orderByMock,
    doc: docMock,
    add: addMock,
  }));
  const serverTimestampMock = vi.fn(() => "SERVER_TIMESTAMP");
  const fromDateMock = vi.fn((date: Date) => ({
    __fromDate: date.toISOString(),
  }));

  return {
    getMock,
    limitMock,
    whereMock,
    orderByMock,
    setMock,
    docMock,
    addMock,
    collectionMock,
    serverTimestampMock,
    fromDateMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({ collection: collectionMock }),
}));

vi.mock("firebase-admin/firestore", () => {
  class MockTimestamp {
    constructor(private date: Date) {}
    toDate() {
      return this.date;
    }
    static fromDate(date: Date) {
      fromDateMock(date);
      return new MockTimestamp(date);
    }
  }

  return {
    FieldValue: { serverTimestamp: serverTimestampMock },
    Timestamp: MockTimestamp,
  };
});

const { savePermissionRecord, listPermissionRecords } =
  await import("./permissions");
const { Timestamp } = await import("firebase-admin/firestore");

const baseInput = {
  email: "user@example.com",
  books: { read: true, create: false, update: false, delete: false },
  manageUsers: false,
  expiresAt: null,
};

describe("savePermissionRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new record when no record exists for the email", async () => {
    getMock.mockResolvedValueOnce({ empty: true, docs: [] });

    await savePermissionRecord(baseInput, "admin@example.com");

    expect(whereMock).toHaveBeenCalledWith("email", "==", "user@example.com");
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(setMock).not.toHaveBeenCalled();

    const created = addMock.mock.calls[0][0];
    expect(created).toMatchObject({
      email: "user@example.com",
      permissions: {
        books: { read: true, create: false, update: false, delete: false },
        users: { manage: false },
      },
      expiresAt: null,
      createdBy: "admin@example.com",
      updatedBy: "admin@example.com",
      lastLoginAt: null,
      createdAt: "SERVER_TIMESTAMP",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  it("updates the existing record instead of creating a duplicate", async () => {
    getMock.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "existing-doc-id" }],
    });

    await savePermissionRecord(baseInput, "admin@example.com");

    expect(docMock).toHaveBeenCalledWith("existing-doc-id");
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" }),
      { merge: true },
    );
    expect(addMock).not.toHaveBeenCalled();
  });

  it("converts a provided expiration date to a Firestore Timestamp", async () => {
    getMock.mockResolvedValueOnce({ empty: true, docs: [] });
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");

    await savePermissionRecord(
      { ...baseInput, expiresAt },
      "admin@example.com",
    );

    expect(fromDateMock).toHaveBeenCalledWith(expiresAt);
    const created = addMock.mock.calls[0][0];
    expect(created.expiresAt).toBeInstanceOf(Timestamp);
  });
});

describe("listPermissionRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Firestore Timestamps to Dates", async () => {
    const createdAt = Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z"));
    getMock.mockResolvedValueOnce({
      docs: [
        {
          id: "doc-1",
          data: () => ({
            email: "user@example.com",
            permissions: {
              books: {
                read: true,
                create: false,
                update: false,
                delete: false,
              },
              users: { manage: true },
            },
            expiresAt: null,
            createdAt,
            createdBy: "admin@example.com",
            updatedAt: createdAt,
            updatedBy: "admin@example.com",
            lastLoginAt: null,
          }),
        },
      ],
    });

    const records = await listPermissionRecords();

    expect(orderByMock).toHaveBeenCalledWith("createdAt", "desc");
    expect(records).toEqual([
      {
        id: "doc-1",
        email: "user@example.com",
        permissions: {
          books: { read: true, create: false, update: false, delete: false },
          users: { manage: true },
        },
        expiresAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        createdBy: "admin@example.com",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedBy: "admin@example.com",
        lastLoginAt: null,
      },
    ]);
  });
});
