import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  bookExistsMock,
  createSourceMock,
  getSourceByIdMock,
  listSourcesMock,
  updateSourceByIdMock,
  deleteSourceByIdMock,
} = vi.hoisted(() => ({
  bookExistsMock: vi.fn(),
  createSourceMock: vi.fn(),
  getSourceByIdMock: vi.fn(),
  listSourcesMock: vi.fn(),
  updateSourceByIdMock: vi.fn(),
  deleteSourceByIdMock: vi.fn(),
}));

vi.mock("@/lib/books/books-service", () => ({
  bookExists: bookExistsMock,
}));

vi.mock("./sources-repository", () => ({
  createSource: createSourceMock,
  getSourceById: getSourceByIdMock,
  listSources: listSourcesMock,
  updateSourceById: updateSourceByIdMock,
  deleteSourceById: deleteSourceByIdMock,
}));

const {
  createSourceService,
  getSourceByIdService,
  updateSourceService,
  deleteSourceService,
  listSourcesService,
} = await import("./sources-service");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listSourcesService", () => {
  it("passes through the repository's list", async () => {
    listSourcesMock.mockResolvedValueOnce([{ id: "doc-1" }]);

    expect(await listSourcesService()).toEqual([{ id: "doc-1" }]);
  });
});

describe("createSourceService", () => {
  it("rejects a body missing bookId or content", async () => {
    const result = await createSourceService({ content: "x" });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid-input", message: expect.any(String) },
    });
    expect(bookExistsMock).not.toHaveBeenCalled();
    expect(createSourceMock).not.toHaveBeenCalled();
  });

  it("rejects a body with unknown fields", async () => {
    const result = await createSourceService({
      bookId: "book-1",
      content: "x",
      id: "spoofed",
    });

    expect(result.ok).toBe(false);
    expect(createSourceMock).not.toHaveBeenCalled();
  });

  it("rejects when bookId does not reference an existing Book", async () => {
    bookExistsMock.mockResolvedValueOnce(false);

    const result = await createSourceService({
      bookId: "book-1",
      content: "x",
    });

    expect(bookExistsMock).toHaveBeenCalledWith("book-1");
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid-input", message: expect.any(String) },
    });
    expect(createSourceMock).not.toHaveBeenCalled();
  });

  it("creates the Source once bookId and content are valid", async () => {
    bookExistsMock.mockResolvedValueOnce(true);
    createSourceMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      content: "x",
    });

    const result = await createSourceService({
      bookId: "book-1",
      content: "x",
    });

    expect(createSourceMock).toHaveBeenCalledWith({
      bookId: "book-1",
      content: "x",
    });
    expect(result).toEqual({
      ok: true,
      value: { id: "doc-1", bookId: "book-1", content: "x" },
    });
  });
});

describe("getSourceByIdService", () => {
  it("rejects an id containing a slash", async () => {
    const result = await getSourceByIdService("a/b");

    expect(result.ok).toBe(false);
    expect(getSourceByIdMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the repository has no record", async () => {
    getSourceByIdMock.mockResolvedValueOnce(null);

    const result = await getSourceByIdService("missing");

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) },
    });
  });

  it("returns the Source on success", async () => {
    getSourceByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      content: "x",
    });

    const result = await getSourceByIdService("doc-1");

    expect(result).toEqual({
      ok: true,
      value: { id: "doc-1", bookId: "book-1", content: "x" },
    });
  });
});

describe("updateSourceService", () => {
  it("rejects an empty patch body", async () => {
    const result = await updateSourceService("doc-1", {});

    expect(result.ok).toBe(false);
    expect(updateSourceByIdMock).not.toHaveBeenCalled();
  });

  it("does not re-validate bookId when the patch doesn't touch it", async () => {
    updateSourceByIdMock.mockResolvedValueOnce({
      id: "doc-1",
      bookId: "book-1",
      content: "new",
    });

    await updateSourceService("doc-1", { content: "new" });

    expect(bookExistsMock).not.toHaveBeenCalled();
    expect(updateSourceByIdMock).toHaveBeenCalledWith("doc-1", {
      content: "new",
    });
  });

  it("re-validates bookId against Book existence when the patch supplies it", async () => {
    bookExistsMock.mockResolvedValueOnce(false);

    const result = await updateSourceService("doc-1", { bookId: "ghost-book" });

    expect(bookExistsMock).toHaveBeenCalledWith("ghost-book");
    expect(result.ok).toBe(false);
    expect(updateSourceByIdMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the repository reports no matching document", async () => {
    updateSourceByIdMock.mockResolvedValueOnce(null);

    const result = await updateSourceService("missing", { content: "x" });

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) },
    });
  });
});

describe("deleteSourceService", () => {
  it("rejects an invalid id", async () => {
    const result = await deleteSourceService("");

    expect(result.ok).toBe(false);
    expect(deleteSourceByIdMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the repository reports nothing was deleted", async () => {
    deleteSourceByIdMock.mockResolvedValueOnce(false);

    const result = await deleteSourceService("missing");

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) },
    });
  });

  it("returns ok on successful deletion", async () => {
    deleteSourceByIdMock.mockResolvedValueOnce(true);

    expect(await deleteSourceService("doc-1")).toEqual({
      ok: true,
      value: undefined,
    });
  });
});
