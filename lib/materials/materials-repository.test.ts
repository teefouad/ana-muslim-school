import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  docMock,
  docGetMock,
  docSetMock,
  docUpdateMock,
  docDeleteMock,
  whereMock,
  whereGetMock,
  limitMock,
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
  limitMock: vi.fn(),
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
  createMaterial,
  getMaterialById,
  listMaterials,
  updateMaterialById,
  upsertMaterialById,
  deleteMaterialById,
  deleteAllMaterialsForBook,
  anyMaterialReferencesModule,
} = await import("./materials-repository");

function setUpFirestoreMocks() {
  docMock.mockImplementation((id?: string) => ({
    id: id ?? "auto-id",
    set: docSetMock,
    get: docGetMock,
    update: docUpdateMock,
    delete: docDeleteMock,
  }));
  limitMock.mockReturnValue({ get: whereGetMock });
  whereMock.mockReturnValue({
    where: whereMock,
    limit: limitMock,
    get: whereGetMock,
  });
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

describe("createMaterial", () => {
  it("creates a Material document with an auto-generated id and no audit fields", async () => {
    const fields = { bookId: "book-1", moduleId: "module-1", content: "x" };

    const material = await createMaterial(fields);

    expect(collectionMock).toHaveBeenCalledWith("materials");
    expect(docSetMock).toHaveBeenCalledWith(fields);
    expect(material).toEqual({ id: "auto-id", ...fields });
  });
});

describe("getMaterialById", () => {
  it("returns null when no document exists", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await getMaterialById("missing")).toBeNull();
  });

  it("returns the parsed Material for an existing document", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "doc-1",
      data: () => ({ bookId: "book-1", moduleId: "module-1", content: "x" }),
    });

    expect(await getMaterialById("doc-1")).toEqual({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });
  });

  it("fails closed on a malformed document", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "doc-1",
      data: () => ({ bookId: "book-1" }),
    });

    expect(await getMaterialById("doc-1")).toBeNull();
  });
});

describe("listMaterials", () => {
  it("maps every document, dropping malformed ones", async () => {
    getMock.mockResolvedValueOnce({
      docs: [
        {
          id: "doc-1",
          data: () => ({
            bookId: "book-1",
            moduleId: "module-1",
            content: "a",
          }),
        },
        { id: "doc-2", data: () => ({ bookId: "book-1" }) },
      ],
    });

    expect(await listMaterials()).toEqual([
      { id: "doc-1", bookId: "book-1", moduleId: "module-1", content: "a" },
    ]);
  });
});

describe("updateMaterialById", () => {
  it("returns null and writes nothing when no document exists", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await updateMaterialById("missing", { content: "y" })).toBeNull();
    expect(docUpdateMock).not.toHaveBeenCalled();
  });

  it("writes only the given fields", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({
      exists: true,
      id: "doc-1",
      data: () => ({ bookId: "book-1", moduleId: "module-1", content: "y" }),
    });

    await updateMaterialById("doc-1", { content: "y" });

    expect(docUpdateMock).toHaveBeenCalledWith({ content: "y" });
  });
});

describe("upsertMaterialById", () => {
  it("fully replaces the document via `.set` without merge, regardless of prior existence", async () => {
    const fields = { bookId: "book-1", moduleId: "module-1", content: "z" };

    const material = await upsertMaterialById("doc-1", fields);

    // No existence check (`.get()`) precedes the write -- upsert never
    // branches on whether the document previously existed.
    expect(docGetMock).not.toHaveBeenCalled();
    expect(docSetMock).toHaveBeenCalledWith(fields);
    expect(docSetMock).not.toHaveBeenCalledWith(fields, { merge: true });
    expect(material).toEqual({ id: "doc-1", ...fields });
  });
});

describe("deleteMaterialById", () => {
  it("returns false and deletes nothing when no document exists", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await deleteMaterialById("missing")).toBe(false);
    expect(docDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes an existing document", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true });

    expect(await deleteMaterialById("doc-1")).toBe(true);
    expect(docDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteAllMaterialsForBook", () => {
  it("queries by bookId and batch-deletes every matching ref", async () => {
    const refs = [{ id: "doc-1" }];
    whereGetMock.mockResolvedValueOnce({ docs: refs.map((ref) => ({ ref })) });

    await deleteAllMaterialsForBook("book-1");

    expect(whereMock).toHaveBeenCalledWith("bookId", "==", "book-1");
    expect(deleteRefsInBatchesMock).toHaveBeenCalledWith(FIRESTORE, refs);
  });
});

describe("anyMaterialReferencesModule", () => {
  it("queries by bookId AND moduleId with a limit of 1", async () => {
    whereGetMock.mockResolvedValueOnce({ empty: false });

    const result = await anyMaterialReferencesModule("book-1", "module-1");

    expect(whereMock).toHaveBeenCalledWith("bookId", "==", "book-1");
    expect(whereMock).toHaveBeenCalledWith("moduleId", "==", "module-1");
    expect(limitMock).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it("returns false when no Material references the module", async () => {
    whereGetMock.mockResolvedValueOnce({ empty: true });

    expect(await anyMaterialReferencesModule("book-1", "module-1")).toBe(false);
  });
});
