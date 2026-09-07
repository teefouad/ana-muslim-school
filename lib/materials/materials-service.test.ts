import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  bookExistsMock,
  moduleExistsMock,
  createMaterialMock,
  getMaterialByIdMock,
  listMaterialsMock,
  updateMaterialByIdMock,
  upsertMaterialByIdMock,
  deleteMaterialByIdMock,
} = vi.hoisted(() => ({
  bookExistsMock: vi.fn(),
  moduleExistsMock: vi.fn(),
  createMaterialMock: vi.fn(),
  getMaterialByIdMock: vi.fn(),
  listMaterialsMock: vi.fn(),
  updateMaterialByIdMock: vi.fn(),
  upsertMaterialByIdMock: vi.fn(),
  deleteMaterialByIdMock: vi.fn(),
}));

vi.mock("@/lib/books/books-service", () => ({
  bookExists: bookExistsMock,
}));

vi.mock("@/lib/modules/modules-service", () => ({
  moduleExists: moduleExistsMock,
}));

vi.mock("./materials-repository", () => ({
  createMaterial: createMaterialMock,
  getMaterialById: getMaterialByIdMock,
  listMaterials: listMaterialsMock,
  updateMaterialById: updateMaterialByIdMock,
  upsertMaterialById: upsertMaterialByIdMock,
  deleteMaterialById: deleteMaterialByIdMock,
}));

const {
  createMaterialService,
  getMaterialByIdService,
  updateMaterialService,
  upsertMaterialService,
  deleteMaterialService,
  listMaterialsService,
} = await import("./materials-service");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listMaterialsService", () => {
  it("passes through the repository's list", async () => {
    listMaterialsMock.mockResolvedValueOnce([{ id: "doc-1" }]);

    expect(await listMaterialsService()).toEqual([{ id: "doc-1" }]);
    expect(listMaterialsMock).toHaveBeenCalledWith(undefined);
  });

  it("forwards a given bookId to the repository's filtered query", async () => {
    listMaterialsMock.mockResolvedValueOnce([
      { id: "doc-1", bookId: "book-1", moduleId: "module-1", content: "a" },
    ]);

    expect(await listMaterialsService("book-1")).toEqual([
      { id: "doc-1", bookId: "book-1", moduleId: "module-1", content: "a" },
    ]);
    expect(listMaterialsMock).toHaveBeenCalledWith("book-1");
  });
});

describe("createMaterialService", () => {
  it("requires the full writable shape (bookId, moduleId, content)", async () => {
    const result = await createMaterialService({ bookId: "book-1" });

    expect(result.ok).toBe(false);
    expect(bookExistsMock).not.toHaveBeenCalled();
    expect(createMaterialMock).not.toHaveBeenCalled();
  });

  it("rejects when bookId does not exist", async () => {
    bookExistsMock.mockResolvedValueOnce(false);

    const result = await createMaterialService({
      bookId: "ghost",
      moduleId: "module-1",
      content: "x",
    });

    expect(bookExistsMock).toHaveBeenCalledWith("ghost");
    expect(result.ok).toBe(false);
    expect(moduleExistsMock).not.toHaveBeenCalled();
    expect(createMaterialMock).not.toHaveBeenCalled();
  });

  it("rejects when moduleId doesn't belong to bookId (different hierarchy)", async () => {
    bookExistsMock.mockResolvedValueOnce(true);
    moduleExistsMock.mockResolvedValueOnce(false);

    const result = await createMaterialService({
      bookId: "book-1",
      moduleId: "module-from-another-book",
      content: "x",
    });

    expect(moduleExistsMock).toHaveBeenCalledWith(
      "book-1",
      "module-from-another-book",
    );
    expect(result.ok).toBe(false);
    expect(createMaterialMock).not.toHaveBeenCalled();
  });

  it("creates the Material once the hierarchy is valid", async () => {
    bookExistsMock.mockResolvedValueOnce(true);
    moduleExistsMock.mockResolvedValueOnce(true);
    createMaterialMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });

    const result = await createMaterialService({
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });

    expect(result.ok).toBe(true);
    expect(createMaterialMock).toHaveBeenCalledWith({
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });
  });
});

describe("getMaterialByIdService", () => {
  it("returns not-found when the repository has no record", async () => {
    getMaterialByIdMock.mockResolvedValueOnce(null);

    const result = await getMaterialByIdService("missing");

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) },
    });
  });
});

describe("updateMaterialService", () => {
  it("returns not-found before parsing the body when the Material doesn't exist", async () => {
    getMaterialByIdMock.mockResolvedValueOnce(null);

    const result = await updateMaterialService("missing", { content: "y" });

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) },
    });
    expect(updateMaterialByIdMock).not.toHaveBeenCalled();
  });

  it("does not re-validate hierarchy when the patch touches neither bookId nor moduleId", async () => {
    getMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "old",
    });
    updateMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "new",
    });

    await updateMaterialService("doc-1", { content: "new" });

    expect(bookExistsMock).not.toHaveBeenCalled();
    expect(moduleExistsMock).not.toHaveBeenCalled();
    expect(updateMaterialByIdMock).toHaveBeenCalledWith("doc-1", {
      content: "new",
    });
  });

  it("validates the resulting hierarchy against the CURRENT bookId when only moduleId is patched", async () => {
    getMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "current-book",
      moduleId: "old-module",
      content: "x",
    });
    bookExistsMock.mockResolvedValueOnce(true);
    moduleExistsMock.mockResolvedValueOnce(true);
    updateMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "current-book",
      moduleId: "new-module",
      content: "x",
    });

    await updateMaterialService("doc-1", { moduleId: "new-module" });

    expect(bookExistsMock).toHaveBeenCalledWith("current-book");
    expect(moduleExistsMock).toHaveBeenCalledWith("current-book", "new-module");
  });

  it("validates the resulting hierarchy against the CURRENT moduleId when only bookId is patched", async () => {
    getMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "old-book",
      moduleId: "current-module",
      content: "x",
    });
    bookExistsMock.mockResolvedValueOnce(true);
    moduleExistsMock.mockResolvedValueOnce(true);
    updateMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "new-book",
      moduleId: "current-module",
      content: "x",
    });

    await updateMaterialService("doc-1", { bookId: "new-book" });

    expect(bookExistsMock).toHaveBeenCalledWith("new-book");
    expect(moduleExistsMock).toHaveBeenCalledWith("new-book", "current-module");
  });

  it("rejects when the patched hierarchy doesn't validate", async () => {
    getMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });
    bookExistsMock.mockResolvedValueOnce(true);
    moduleExistsMock.mockResolvedValueOnce(false);

    const result = await updateMaterialService("doc-1", {
      moduleId: "foreign-module",
    });

    expect(result.ok).toBe(false);
    expect(updateMaterialByIdMock).not.toHaveBeenCalled();
  });

  it("rejects an empty patch body", async () => {
    getMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });

    const result = await updateMaterialService("doc-1", {});

    expect(result.ok).toBe(false);
    expect(updateMaterialByIdMock).not.toHaveBeenCalled();
  });
});

describe("upsertMaterialService", () => {
  it("requires the full writable shape, same as create", async () => {
    const result = await upsertMaterialService("doc-1", { bookId: "book-1" });

    expect(result.ok).toBe(false);
    expect(upsertMaterialByIdMock).not.toHaveBeenCalled();
  });

  it("validates the hierarchy before upserting", async () => {
    bookExistsMock.mockResolvedValueOnce(false);

    const result = await upsertMaterialService("doc-1", {
      bookId: "ghost",
      moduleId: "module-1",
      content: "x",
    });

    expect(result.ok).toBe(false);
    expect(upsertMaterialByIdMock).not.toHaveBeenCalled();
  });

  it("upserts at the exact given id once valid, regardless of prior existence", async () => {
    bookExistsMock.mockResolvedValueOnce(true);
    moduleExistsMock.mockResolvedValueOnce(true);
    upsertMaterialByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });

    const result = await upsertMaterialService("doc-1", {
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });

    expect(upsertMaterialByIdMock).toHaveBeenCalledWith("doc-1", {
      bookId: "book-1",
      moduleId: "module-1",
      content: "x",
    });
    expect(result.ok).toBe(true);
  });
});

describe("deleteMaterialService", () => {
  it("returns not-found when nothing was deleted", async () => {
    deleteMaterialByIdMock.mockResolvedValueOnce(false);

    const result = await deleteMaterialService("missing");

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) },
    });
  });

  it("returns ok on success", async () => {
    deleteMaterialByIdMock.mockResolvedValueOnce(true);

    expect(await deleteMaterialService("doc-1")).toEqual({
      ok: true,
      value: undefined,
    });
  });
});
