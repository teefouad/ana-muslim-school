import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  docMock,
  docGetMock,
  docSetMock,
  docUpdateMock,
  docDeleteMock,
  whereMock,
  whereGetMock,
  getMock,
  collectionMock,
  deleteRefsInBatchesMock,
} = vi.hoisted(() => ({
  docMock: vi.fn(),
  docGetMock: vi.fn(),
  docSetMock: vi.fn(),
  docUpdateMock: vi.fn(),
  docDeleteMock: vi.fn(),
  whereMock: vi.fn(),
  whereGetMock: vi.fn(),
  getMock: vi.fn(),
  collectionMock: vi.fn(),
  deleteRefsInBatchesMock: vi.fn(),
}));

const FIRESTORE = { collection: collectionMock };

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => FIRESTORE,
}));

vi.mock("@/lib/firestore/delete-refs-in-batches", () => ({
  deleteRefsInBatches: deleteRefsInBatchesMock,
}));

const {
  createSource,
  getSourceById,
  listSources,
  updateSourceById,
  deleteSourceById,
  deleteAllSourcesForBook,
} = await import("./sources-repository");

const AUTO_DOC_REF = { id: "auto-id" };

function setUpFirestoreMocks() {
  docMock.mockImplementation((id?: string) =>
    id === undefined
      ? { ...AUTO_DOC_REF, set: docSetMock, get: docGetMock }
      : {
          id,
          set: docSetMock,
          get: docGetMock,
          update: docUpdateMock,
          delete: docDeleteMock,
        },
  );
  whereMock.mockReturnValue({ get: whereGetMock });
  collectionMock.mockReturnValue({
    doc: docMock,
    where: whereMock,
    get: getMock,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  setUpFirestoreMocks();
});

describe("createSource", () => {
  it("creates a Source document with an auto-generated id and no audit fields", async () => {
    const source = await createSource({ bookId: "book-1", content: "text" });

    expect(collectionMock).toHaveBeenCalledWith("sources");
    expect(docSetMock).toHaveBeenCalledWith({
      bookId: "book-1",
      content: "text",
    });
    expect(source).toEqual({
      id: "auto-id",
      bookId: "book-1",
      content: "text",
    });
  });
});

describe("getSourceById", () => {
  it("returns null when no document exists for the id", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await getSourceById("missing")).toBeNull();
    expect(docMock).toHaveBeenCalledWith("missing");
  });

  it("returns the parsed Source for an existing, well-formed document", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "doc-1",
      data: () => ({ bookId: "book-1", content: "text" }),
    });

    expect(await getSourceById("doc-1")).toEqual({
      id: "doc-1",
      bookId: "book-1",
      content: "text",
    });
  });

  it("fails closed (returns null) for a malformed document", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "doc-1",
      data: () => ({ bookId: "book-1" }), // missing `content`
    });

    expect(await getSourceById("doc-1")).toBeNull();
  });
});

describe("listSources", () => {
  it("maps every well-formed document and drops malformed ones", async () => {
    getMock.mockResolvedValueOnce({
      docs: [
        { id: "doc-1", data: () => ({ bookId: "book-1", content: "a" }) },
        { id: "doc-2", data: () => ({ bookId: "book-1" }) },
      ],
    });

    expect(await listSources()).toEqual([
      { id: "doc-1", bookId: "book-1", content: "a" },
    ]);
  });
});

describe("updateSourceById", () => {
  it("returns null and writes nothing when no document exists for the id", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await updateSourceById("missing", { content: "new" })).toBeNull();
    expect(docUpdateMock).not.toHaveBeenCalled();
  });

  it("writes only the given fields and returns the updated Source", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({
      exists: true,
      id: "doc-1",
      data: () => ({ bookId: "book-1", content: "new" }),
    });

    const updated = await updateSourceById("doc-1", { content: "new" });

    expect(docUpdateMock).toHaveBeenCalledWith({ content: "new" });
    expect(updated).toEqual({ id: "doc-1", bookId: "book-1", content: "new" });
  });
});

describe("deleteSourceById", () => {
  it("returns false and deletes nothing when no document exists for the id", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await deleteSourceById("missing")).toBe(false);
    expect(docDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the document for an existing id", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true });

    expect(await deleteSourceById("doc-1")).toBe(true);
    expect(docDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteAllSourcesForBook", () => {
  it("queries by bookId and batch-deletes every matching document's ref", async () => {
    const refs = [{ id: "doc-1" }, { id: "doc-2" }];
    whereGetMock.mockResolvedValueOnce({
      docs: refs.map((ref) => ({ ref })),
    });

    await deleteAllSourcesForBook("book-1");

    expect(whereMock).toHaveBeenCalledWith("bookId", "==", "book-1");
    expect(deleteRefsInBatchesMock).toHaveBeenCalledWith(FIRESTORE, refs);
  });
});
