import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBookMock,
  getBookByIdMock,
  listBooksMock,
  updateBookByIdMock,
  deleteBookDocumentMock,
  deleteAllLessonsForModuleMock,
  deleteAllQuestionsForModuleMock,
  deleteModulesByIdsMock,
  deleteAllSourcesForBookMock,
  deleteAllMaterialsForBookMock,
} = vi.hoisted(() => ({
  createBookMock: vi.fn(),
  getBookByIdMock: vi.fn(),
  listBooksMock: vi.fn(),
  updateBookByIdMock: vi.fn(),
  deleteBookDocumentMock: vi.fn(),
  deleteAllLessonsForModuleMock: vi.fn(),
  deleteAllQuestionsForModuleMock: vi.fn(),
  deleteModulesByIdsMock: vi.fn(),
  deleteAllSourcesForBookMock: vi.fn(),
  deleteAllMaterialsForBookMock: vi.fn(),
}));

vi.mock("./books-repository", () => ({
  createBook: createBookMock,
  getBookById: getBookByIdMock,
  listBooks: listBooksMock,
  updateBookById: updateBookByIdMock,
  deleteBookDocument: deleteBookDocumentMock,
  bookExists: vi.fn(),
}));

vi.mock("@/lib/lessons/lessons-repository", () => ({
  deleteAllLessonsForModule: deleteAllLessonsForModuleMock,
}));

vi.mock("@/lib/questions/questions-repository", () => ({
  deleteAllQuestionsForModule: deleteAllQuestionsForModuleMock,
}));

vi.mock("@/lib/modules/modules-repository", () => ({
  deleteModulesByIds: deleteModulesByIdsMock,
}));

vi.mock("@/lib/sources/sources-repository", () => ({
  deleteAllSourcesForBook: deleteAllSourcesForBookMock,
}));

vi.mock("@/lib/materials/materials-repository", () => ({
  deleteAllMaterialsForBook: deleteAllMaterialsForBookMock,
}));

const {
  createBookService,
  getBookByIdService,
  updateBookService,
  deleteBookService,
} = await import("./books-service");

const writableFields = {
  title: { ar: "أ", en: "a" },
  description: { ar: "و", en: "d" },
  longDescription: { ar: "ط", en: "l" },
  color: "#fff",
  imageId: "img-1",
  isLocked: false,
  isPublished: true,
};

function book(overrides: Record<string, unknown> = {}) {
  return {
    id: "book-1",
    ...writableFields,
    modules: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createBookService", () => {
  it.each(Object.keys(writableFields))(
    "rejects a body missing required field %s",
    async (missingField) => {
      const body = { ...writableFields };
      delete (body as Record<string, unknown>)[missingField];

      const result = await createBookService(body, "admin@example.com");

      expect(result).toMatchObject({
        ok: false,
        error: { code: "invalid-input" },
      });
      expect(createBookMock).not.toHaveBeenCalled();
    },
  );

  it("rejects unknown/non-writable fields (spoofed modules, id, createdBy)", async () => {
    const result = await createBookService(
      {
        ...writableFields,
        modules: ["m1"],
        id: "spoofed",
        createdBy: "attacker@example.com",
      },
      "admin@example.com",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
    expect(createBookMock).not.toHaveBeenCalled();
  });

  it("creates the book on valid input", async () => {
    createBookMock.mockResolvedValueOnce(book());

    const result = await createBookService(writableFields, "admin@example.com");

    expect(createBookMock).toHaveBeenCalledWith(
      writableFields,
      "admin@example.com",
    );
    expect(result).toEqual({ ok: true, value: book() });
  });
});

describe("getBookByIdService", () => {
  it("rejects an invalid id shape", async () => {
    const result = await getBookByIdService("a/b");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
    expect(getBookByIdMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the book doesn't exist", async () => {
    getBookByIdMock.mockResolvedValueOnce(null);

    const result = await getBookByIdService("missing");

    expect(result).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("returns the book when found", async () => {
    getBookByIdMock.mockResolvedValueOnce(book());

    const result = await getBookByIdService("book-1");

    expect(result).toEqual({ ok: true, value: book() });
  });
});

describe("updateBookService", () => {
  it("rejects an empty body", async () => {
    const result = await updateBookService("book-1", {}, "admin@example.com");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
    expect(updateBookByIdMock).not.toHaveBeenCalled();
  });

  it("updates only the given field, leaving others untouched", async () => {
    updateBookByIdMock.mockResolvedValueOnce(book({ color: "#000" }));

    await updateBookService("book-1", { color: "#000" }, "admin@example.com");

    expect(updateBookByIdMock).toHaveBeenCalledWith({
      id: "book-1",
      fields: { color: "#000" },
      modulesReorder: undefined,
      actorEmail: "admin@example.com",
    });
  });

  it("accepts a modules reorder and forwards it to the repository", async () => {
    updateBookByIdMock.mockResolvedValueOnce(book({ modules: ["b", "a"] }));

    const result = await updateBookService(
      "book-1",
      { modules: ["b", "a"] },
      "admin@example.com",
    );

    expect(result.ok).toBe(true);
    expect(updateBookByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ modulesReorder: ["b", "a"] }),
    );
  });

  it("maps the repository's 'invalid-reorder' outcome to an invalid-input error", async () => {
    // Permutation validity is re-checked against the live array inside the
    // repository's transaction (see lib/books/books-repository.ts), not
    // pre-validated here -- that's what closes the race against a
    // concurrent Module create/delete. This service test only needs to
    // verify the sentinel gets mapped to the right service error.
    updateBookByIdMock.mockResolvedValueOnce("invalid-reorder");

    const result = await updateBookService(
      "book-1",
      { modules: ["a", "a"] },
      "admin@example.com",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
  });

  it("returns not-found when reordering modules on a missing book", async () => {
    updateBookByIdMock.mockResolvedValueOnce(null);

    const result = await updateBookService(
      "missing",
      { modules: [] },
      "admin@example.com",
    );

    expect(result).toMatchObject({ ok: false, error: { code: "not-found" } });
  });
});

describe("deleteBookService", () => {
  it("returns not-found when the book doesn't exist", async () => {
    getBookByIdMock.mockResolvedValueOnce(null);

    const result = await deleteBookService("missing");

    expect(result).toMatchObject({ ok: false, error: { code: "not-found" } });
    expect(deleteBookDocumentMock).not.toHaveBeenCalled();
  });

  it("cascades through every module's lessons/questions, bulk-deletes the modules, then sources/materials, then the book -- never conflicting even though the book still has content", async () => {
    getBookByIdMock.mockResolvedValueOnce(book({ modules: ["m1", "m2"] }));
    const calls: string[] = [];
    deleteAllLessonsForModuleMock.mockImplementation(
      async (bookId, moduleId) => {
        calls.push(`lessons:${moduleId}`);
      },
    );
    deleteAllQuestionsForModuleMock.mockImplementation(
      async (bookId, moduleId) => {
        calls.push(`questions:${moduleId}`);
      },
    );
    deleteModulesByIdsMock.mockImplementation(async () =>
      calls.push("modules"),
    );
    deleteAllSourcesForBookMock.mockImplementation(async () =>
      calls.push("sources"),
    );
    deleteAllMaterialsForBookMock.mockImplementation(async () =>
      calls.push("materials"),
    );
    deleteBookDocumentMock.mockImplementation(async () => calls.push("book"));

    const result = await deleteBookService("book-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deleteAllLessonsForModuleMock).toHaveBeenCalledWith("book-1", "m1");
    expect(deleteAllQuestionsForModuleMock).toHaveBeenCalledWith(
      "book-1",
      "m1",
    );
    expect(deleteAllLessonsForModuleMock).toHaveBeenCalledWith("book-1", "m2");
    expect(deleteAllQuestionsForModuleMock).toHaveBeenCalledWith(
      "book-1",
      "m2",
    );
    expect(deleteModulesByIdsMock).toHaveBeenCalledWith("book-1", ["m1", "m2"]);
    expect(calls.indexOf("modules")).toBeGreaterThan(
      calls.indexOf("questions:m2"),
    );
    expect(calls.indexOf("book")).toBe(calls.length - 1);
    expect(calls.indexOf("sources")).toBeLessThan(calls.indexOf("book"));
    expect(calls.indexOf("materials")).toBeLessThan(calls.indexOf("book"));
  });

  it("skips deleteModulesByIds for a book with no modules, but still deletes sources/materials/the book doc", async () => {
    getBookByIdMock.mockResolvedValueOnce(book({ modules: [] }));

    const result = await deleteBookService("book-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deleteModulesByIdsMock).not.toHaveBeenCalled();
    expect(deleteAllSourcesForBookMock).toHaveBeenCalledWith("book-1");
    expect(deleteAllMaterialsForBookMock).toHaveBeenCalledWith("book-1");
    expect(deleteBookDocumentMock).toHaveBeenCalledWith("book-1");
  });
});
