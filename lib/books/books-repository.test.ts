import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  docMock,
  docGetMock,
  docSetMock,
  docUpdateMock,
  docDeleteMock,
  getMock,
  collectionMock,
  transactionGetMock,
  transactionUpdateMock,
  runTransactionMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn();
  const docUpdateMock = vi.fn();
  const docDeleteMock = vi.fn();
  const docMock = vi.fn();
  const getMock = vi.fn();
  const collectionMock = vi.fn();
  const transactionGetMock = vi.fn();
  const transactionUpdateMock = vi.fn();
  const runTransactionMock = vi.fn();

  return {
    docMock,
    docGetMock,
    docSetMock,
    docUpdateMock,
    docDeleteMock,
    getMock,
    collectionMock,
    transactionGetMock,
    transactionUpdateMock,
    runTransactionMock,
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
}));

const {
  createBook,
  getBookById,
  listBooks,
  updateBookById,
  deleteBookDocument,
} = await import("./books-repository");

const AUTO_DOC_REF = {
  id: "auto-id",
  set: docSetMock,
  get: docGetMock,
};

function setUpFirestoreMocks() {
  docMock.mockImplementation((id?: string) =>
    id === undefined
      ? AUTO_DOC_REF
      : {
          id,
          get: docGetMock,
          update: docUpdateMock,
          delete: docDeleteMock,
        },
  );
  collectionMock.mockReturnValue({ doc: docMock, get: getMock });
  runTransactionMock.mockImplementation(async (fn) =>
    fn({ get: transactionGetMock, update: transactionUpdateMock }),
  );
}

const writableFields = {
  title: { ar: "أ", en: "a" },
  description: { ar: "و", en: "d" },
  longDescription: { ar: "ط", en: "l" },
  color: "#fff",
  imageId: "img-1",
  isLocked: false,
  isPublished: true,
};

function rawBookData(overrides: Record<string, unknown> = {}) {
  const createdAt = { toDate: () => new Date("2026-01-01T00:00:00.000Z") };
  return {
    ...writableFields,
    modules: [],
    createdAt,
    createdBy: "admin@example.com",
    updatedAt: createdAt,
    updatedBy: "admin@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  setUpFirestoreMocks();
});

describe("createBook", () => {
  it("initializes modules to [] regardless of the given fields, and stamps audit fields", async () => {
    docGetMock.mockResolvedValueOnce({
      id: "auto-id",
      data: () => rawBookData(),
    });

    const book = await createBook(writableFields, "admin@example.com");

    expect(docSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...writableFields,
        modules: [],
        createdBy: "admin@example.com",
        updatedBy: "admin@example.com",
        createdAt: SERVER_TIMESTAMP_SENTINEL,
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
      }),
    );
    expect(book.id).toBe("auto-id");
    expect(book.modules).toEqual([]);
  });

  it("throws if the document can't be read back as a valid Book", async () => {
    docGetMock.mockResolvedValueOnce({ id: "auto-id", data: () => null });

    await expect(
      createBook(writableFields, "admin@example.com"),
    ).rejects.toThrow();
  });
});

describe("getBookById", () => {
  it("returns null when the document doesn't exist", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await getBookById("missing")).toBeNull();
  });

  it("fails closed when the document is missing a required field", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "book-1",
      data: () => {
        const data: Record<string, unknown> = rawBookData();
        delete data.isLocked;
        return data;
      },
    });

    expect(await getBookById("book-1")).toBeNull();
  });

  it("returns the parsed Book, materializing id from the doc id (no persisted id field)", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "book-1",
      data: () => rawBookData({ modules: ["m1"] }),
    });

    const book = await getBookById("book-1");

    expect(book).toMatchObject({ id: "book-1", modules: ["m1"] });
  });
});

describe("listBooks", () => {
  it("maps every valid doc and filters out malformed ones", async () => {
    getMock.mockResolvedValueOnce({
      docs: [
        { id: "book-1", data: () => rawBookData() },
        { id: "book-2", data: () => ({ garbage: true }) },
      ],
    });

    const books = await listBooks();

    expect(books).toHaveLength(1);
    expect(books[0].id).toBe("book-1");
  });
});

describe("updateBookById", () => {
  it("returns null without writing when the document doesn't exist", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    const result = await updateBookById({
      id: "missing",
      fields: { color: "#000" },
      actorEmail: "admin@example.com",
    });

    expect(result).toBeNull();
    expect(docUpdateMock).not.toHaveBeenCalled();
  });

  it("merges given fields into the update alongside updatedAt/updatedBy", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({
      id: "book-1",
      data: () => rawBookData({ color: "#000" }),
    });

    await updateBookById({
      id: "book-1",
      fields: { color: "#000" },
      actorEmail: "admin@example.com",
    });

    expect(docUpdateMock).toHaveBeenCalledWith({
      color: "#000",
      updatedAt: SERVER_TIMESTAMP_SENTINEL,
      updatedBy: "admin@example.com",
    });
  });

  it("writes modulesReorder as `modules` inside a transaction, re-validated against the live array", async () => {
    transactionGetMock.mockResolvedValueOnce({
      exists: true,
      id: "book-1",
      data: () => rawBookData({ modules: ["a", "b"] }),
    });
    docGetMock.mockResolvedValueOnce({
      id: "book-1",
      data: () => rawBookData({ modules: ["b", "a"] }),
    });

    const result = await updateBookById({
      id: "book-1",
      modulesReorder: ["b", "a"],
      actorEmail: "admin@example.com",
    });

    expect(runTransactionMock).toHaveBeenCalledTimes(1);
    expect(transactionUpdateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        modules: ["b", "a"],
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
        updatedBy: "admin@example.com",
      }),
    );
    expect(docUpdateMock).not.toHaveBeenCalled();
    expect(result).not.toBe(null);
    expect(result).not.toBe("invalid-reorder");
  });

  it("returns null without writing when reordering modules on a missing book", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: false });

    const result = await updateBookById({
      id: "missing",
      modulesReorder: ["a"],
      actorEmail: "admin@example.com",
    });

    expect(result).toBeNull();
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 'invalid-reorder' without writing when the live modules array no longer matches", async () => {
    transactionGetMock.mockResolvedValueOnce({
      exists: true,
      id: "book-1",
      data: () => rawBookData({ modules: ["a", "b", "c"] }),
    });

    const result = await updateBookById({
      id: "book-1",
      modulesReorder: ["a", "b"],
      actorEmail: "admin@example.com",
    });

    expect(result).toBe("invalid-reorder");
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("touches only updatedAt/updatedBy when neither fields nor modulesReorder are given", async () => {
    docGetMock
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ id: "book-1", data: () => rawBookData() });

    await updateBookById({ id: "book-1", actorEmail: "admin@example.com" });

    expect(docUpdateMock).toHaveBeenCalledWith({
      updatedAt: SERVER_TIMESTAMP_SENTINEL,
      updatedBy: "admin@example.com",
    });
  });
});

describe("deleteBookDocument", () => {
  it("deletes the document without checking existence first", async () => {
    await deleteBookDocument("book-1");

    expect(docMock).toHaveBeenCalledWith("book-1");
    expect(docDeleteMock).toHaveBeenCalledTimes(1);
    expect(docGetMock).not.toHaveBeenCalled();
  });
});
