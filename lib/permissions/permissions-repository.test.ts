import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionGetMock,
  transactionSetMock,
  transactionUpdateMock,
  runTransactionMock,
  whereMock,
  limitMock,
  docMock,
  orderByMock,
  getMock,
  collectionMock,
} = vi.hoisted(() => {
  const transactionGetMock = vi.fn();
  const transactionSetMock = vi.fn();
  const transactionUpdateMock = vi.fn();
  const runTransactionMock = vi.fn();
  const limitMock = vi.fn();
  const whereMock = vi.fn();
  const docMock = vi.fn();
  const orderByMock = vi.fn();
  const getMock = vi.fn();
  const collectionMock = vi.fn();

  return {
    transactionGetMock,
    transactionSetMock,
    transactionUpdateMock,
    runTransactionMock,
    whereMock,
    limitMock,
    docMock,
    orderByMock,
    getMock,
    collectionMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  }),
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

const AUTO_DOC_REF = { id: "auto-id" };

function setUpFirestoreMocks() {
  limitMock.mockReturnValue({ __query: true });
  whereMock.mockReturnValue({ limit: limitMock });
  docMock.mockReturnValue(AUTO_DOC_REF);
  orderByMock.mockReturnValue({ get: getMock });
  collectionMock.mockReturnValue({
    where: whereMock,
    doc: docMock,
    orderBy: orderByMock,
  });
  runTransactionMock.mockImplementation(async (fn) =>
    fn({
      get: transactionGetMock,
      set: transactionSetMock,
      update: transactionUpdateMock,
    }),
  );
}

describe("upsertPermission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setUpFirestoreMocks();
  });

  it("creates a new record when no record exists for the email", async () => {
    transactionGetMock.mockResolvedValueOnce({ empty: true, docs: [] });

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
    expect(transactionSetMock).toHaveBeenCalledWith(
      AUTO_DOC_REF,
      expect.objectContaining({
        email: "someone@example.com",
        permissions,
        expiresAt: null,
        createdBy: "admin@example.com",
        updatedBy: "admin@example.com",
        lastLoginAt: null,
      }),
    );
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("updates the existing record instead of creating a duplicate", async () => {
    const existingRef = { id: "existing-doc" };
    transactionGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [{ ref: existingRef }],
    });

    await upsertPermission({
      email: "someone@example.com",
      permissions,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(transactionUpdateMock).toHaveBeenCalledWith(
      existingRef,
      expect.objectContaining({
        permissions,
        expiresAt: null,
        updatedBy: "admin@example.com",
      }),
    );
    expect(transactionSetMock).not.toHaveBeenCalled();
  });

  it("converts a provided expiration date to a Firestore Timestamp", async () => {
    transactionGetMock.mockResolvedValueOnce({ empty: true, docs: [] });
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");

    await upsertPermission({
      email: "someone@example.com",
      permissions,
      expiresAt,
      actorEmail: "admin@example.com",
    });

    expect(transactionSetMock).toHaveBeenCalledWith(
      AUTO_DOC_REF,
      expect.objectContaining({
        expiresAt: expect.objectContaining({ __isTimestamp: true }),
      }),
    );
  });

  it("looks up and writes within the same transaction, so concurrent calls can't race", async () => {
    transactionGetMock.mockResolvedValueOnce({ empty: true, docs: [] });

    await upsertPermission({
      email: "someone@example.com",
      permissions,
      expiresAt: null,
      actorEmail: "admin@example.com",
    });

    expect(runTransactionMock).toHaveBeenCalledTimes(1);
    // The lookup must happen through `transaction.get`, not a plain
    // `collection.get()`, so it holds a lock for the life of the
    // transaction -- see lib/permissions/permissions-repository.ts.
    expect(transactionGetMock).toHaveBeenCalledWith({ __query: true });
  });
});

describe("listPermissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setUpFirestoreMocks();
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
