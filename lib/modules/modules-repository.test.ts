import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionGetMock,
  transactionSetMock,
  transactionUpdateMock,
  transactionDeleteMock,
  runTransactionMock,
  docMock,
  docGetMock,
  docUpdateMock,
  collectionMock,
  getAllMock,
  batchDeleteMock,
  batchCommitMock,
  batchMock,
} = vi.hoisted(() => {
  const transactionGetMock = vi.fn();
  const transactionSetMock = vi.fn();
  const transactionUpdateMock = vi.fn();
  const transactionDeleteMock = vi.fn();
  const runTransactionMock = vi.fn();
  const docMock = vi.fn();
  const docGetMock = vi.fn();
  const docUpdateMock = vi.fn();
  const collectionMock = vi.fn();
  const getAllMock = vi.fn();
  const batchDeleteMock = vi.fn();
  const batchCommitMock = vi.fn();
  const batchMock = vi.fn(() => ({
    delete: batchDeleteMock,
    commit: batchCommitMock,
  }));

  return {
    transactionGetMock,
    transactionSetMock,
    transactionUpdateMock,
    transactionDeleteMock,
    runTransactionMock,
    docMock,
    docGetMock,
    docUpdateMock,
    collectionMock,
    getAllMock,
    batchDeleteMock,
    batchCommitMock,
    batchMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
    getAll: getAllMock,
    batch: batchMock,
  }),
}));

const SERVER_TIMESTAMP_SENTINEL = Symbol("serverTimestamp");

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL,
    arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
    arrayRemove: (...values: unknown[]) => ({ __arrayRemove: values }),
  },
}));

const {
  createModule,
  getModuleById,
  moduleExists,
  listModulesByIds,
  updateModuleById,
  deleteModuleById,
  deleteModulesByIds,
} = await import("./modules-repository");

const validModuleData = {
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  color: "#fff",
  lessons: [],
  isLocked: false,
  isPublished: false,
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

function moduleDocRef(id: string) {
  return {
    id,
    collection: vi.fn(() => ({ doc: docMock })),
    get: docGetMock,
  };
}

function setUpFirestoreMocks() {
  const bookRef = { id: "book-1" };
  const moduleRef = moduleDocRef("module-1");

  docMock.mockImplementation((id?: string) => {
    if (id === undefined) {
      return moduleRef;
    }
    return { ...moduleRef, id, get: docGetMock, update: docUpdateMock };
  });

  collectionMock.mockImplementation(() => ({
    doc: (id?: string) => {
      if (id === undefined) {
        return bookRef;
      }
      return {
        ...bookRef,
        id,
        collection: () => ({ doc: docMock }),
      };
    },
  }));

  runTransactionMock.mockImplementation(async (fn) =>
    fn({
      get: transactionGetMock,
      set: transactionSetMock,
      update: transactionUpdateMock,
      delete: transactionDeleteMock,
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setUpFirestoreMocks();
});

describe("createModule", () => {
  it("returns null without writing when the parent Book doesn't exist", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: false });

    const result = await createModule(
      "book-1",
      {
        title: validModuleData.title,
        description: validModuleData.description,
        color: validModuleData.color,
        isLocked: false,
        isPublished: false,
      },
      "admin@example.com",
    );

    expect(result).toBeNull();
    expect(transactionSetMock).not.toHaveBeenCalled();
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("sets the module doc with lessons: [] and appends its id to Book.modules in the same transaction", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: true });
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "module-1",
      data: () => validModuleData,
    });

    const result = await createModule(
      "book-1",
      {
        title: validModuleData.title,
        description: validModuleData.description,
        color: validModuleData.color,
        isLocked: false,
        isPublished: false,
      },
      "admin@example.com",
    );

    expect(transactionSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "module-1" }),
      expect.objectContaining({
        lessons: [],
        createdAt: SERVER_TIMESTAMP_SENTINEL,
        createdBy: "admin@example.com",
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
        updatedBy: "admin@example.com",
      }),
    );
    expect(transactionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "book-1" }),
      {
        modules: { __arrayUnion: ["module-1"] },
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
        updatedBy: "admin@example.com",
      },
    );
    expect(result).not.toBeNull();
  });
});

describe("getModuleById / moduleExists", () => {
  it("returns null/false when the module doc is missing", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });
    expect(await getModuleById("book-1", "module-1")).toBeNull();

    docGetMock.mockResolvedValueOnce({ exists: false });
    expect(await moduleExists("book-1", "module-1")).toBe(false);
  });

  it("returns the parsed module when it exists", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "module-1",
      data: () => validModuleData,
    });

    const found = await getModuleById("book-1", "module-1");
    expect(found).toMatchObject({ id: "module-1", color: "#fff" });
  });
});

describe("listModulesByIds", () => {
  it("returns an empty array without calling getAll for an empty id list", async () => {
    expect(await listModulesByIds("book-1", [])).toEqual([]);
    expect(getAllMock).not.toHaveBeenCalled();
  });

  it("returns modules in the exact given order via getAll, not natural/sorted order", async () => {
    getAllMock.mockResolvedValueOnce([
      { exists: true, id: "module-b", data: () => validModuleData },
      { exists: true, id: "module-a", data: () => validModuleData },
    ]);

    const result = await listModulesByIds("book-1", ["module-b", "module-a"]);

    expect(result.map((m) => m.id)).toEqual(["module-b", "module-a"]);
  });
});

describe("updateModuleById", () => {
  it("returns null without writing when the module doesn't exist", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    const result = await updateModuleById({
      bookId: "book-1",
      moduleId: "module-1",
      fields: { color: "#000" },
      actorEmail: "admin@example.com",
    });

    expect(result).toBeNull();
    expect(docUpdateMock).not.toHaveBeenCalled();
  });

  it("writes lessonsReorder to the lessons field inside a transaction, re-validated against the live array", async () => {
    transactionGetMock.mockResolvedValueOnce({
      exists: true,
      id: "module-1",
      data: () => ({ ...validModuleData, lessons: ["l1", "l2"] }),
    });
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "module-1",
      data: () => ({ ...validModuleData, lessons: ["l2", "l1"] }),
    });

    const result = await updateModuleById({
      bookId: "book-1",
      moduleId: "module-1",
      fields: { color: "#000" },
      lessonsReorder: ["l2", "l1"],
      actorEmail: "admin@example.com",
    });

    expect(transactionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "module-1" }),
      expect.objectContaining({
        color: "#000",
        lessons: ["l2", "l1"],
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
        updatedBy: "admin@example.com",
      }),
    );
    expect(docUpdateMock).not.toHaveBeenCalled();
    expect(result).not.toBe(null);
    expect(result).not.toBe("invalid-reorder");
  });

  it("returns 'invalid-reorder' without writing when the live lessons array no longer matches", async () => {
    transactionGetMock.mockResolvedValueOnce({
      exists: true,
      id: "module-1",
      data: () => ({ ...validModuleData, lessons: ["l1", "l2", "l3"] }),
    });

    const result = await updateModuleById({
      bookId: "book-1",
      moduleId: "module-1",
      lessonsReorder: ["l1", "l2"],
      actorEmail: "admin@example.com",
    });

    expect(result).toBe("invalid-reorder");
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });
});

describe("deleteModuleById", () => {
  it("returns false without writing when the module doesn't exist", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: false });

    const result = await deleteModuleById(
      "book-1",
      "module-1",
      "admin@example.com",
    );

    expect(result).toBe(false);
    expect(transactionDeleteMock).not.toHaveBeenCalled();
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("deletes the module doc and removes its id from Book.modules in the same transaction, refreshing the Book's audit fields", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: true });

    const result = await deleteModuleById(
      "book-1",
      "module-1",
      "admin@example.com",
    );

    expect(result).toBe(true);
    expect(transactionDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "module-1" }),
    );
    expect(transactionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "book-1" }),
      {
        modules: { __arrayRemove: ["module-1"] },
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
        updatedBy: "admin@example.com",
      },
    );
  });
});

describe("deleteModulesByIds", () => {
  it("does nothing for an empty list", async () => {
    await deleteModulesByIds("book-1", []);
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("bulk-deletes module docs without touching the Book document", async () => {
    await deleteModulesByIds("book-1", ["module-1", "module-2"]);

    expect(batchDeleteMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });
});
