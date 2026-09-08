import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBookByIdServiceMock,
  deleteMaterialsByModuleMock,
  anyQuestionExistsMock,
  createModuleInRepoMock,
  deleteModuleByIdMock,
  getModuleByIdFromRepoMock,
  listModulesByIdsMock,
  moduleExistsInRepoMock,
  updateModuleByIdMock,
} = vi.hoisted(() => ({
  getBookByIdServiceMock: vi.fn(),
  deleteMaterialsByModuleMock: vi.fn(),
  anyQuestionExistsMock: vi.fn(),
  createModuleInRepoMock: vi.fn(),
  deleteModuleByIdMock: vi.fn(),
  getModuleByIdFromRepoMock: vi.fn(),
  listModulesByIdsMock: vi.fn(),
  moduleExistsInRepoMock: vi.fn(),
  updateModuleByIdMock: vi.fn(),
}));

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
}));

vi.mock("@/lib/materials/materials-repository", () => ({
  deleteMaterialsByModule: deleteMaterialsByModuleMock,
}));

vi.mock("@/lib/questions/questions-repository", () => ({
  anyQuestionExists: anyQuestionExistsMock,
}));

vi.mock("./modules-repository", () => ({
  createModule: createModuleInRepoMock,
  deleteModuleById: deleteModuleByIdMock,
  getModuleById: getModuleByIdFromRepoMock,
  listModulesByIds: listModulesByIdsMock,
  moduleExists: moduleExistsInRepoMock,
  updateModuleById: updateModuleByIdMock,
}));

const {
  createModuleService,
  deleteModuleService,
  getModuleByIdService,
  listModulesService,
  moduleExists,
  updateModuleService,
} = await import("./modules-service");

const validModule = {
  id: "module-1",
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  color: "#fff",
  lessons: ["lesson-1"],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

const validBook = {
  id: "book-1",
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  longDescription: { ar: "أ", en: "a" },
  color: "#fff",
  imageId: "img",
  modules: ["module-1"],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("moduleExists", () => {
  it("delegates to the repository", async () => {
    moduleExistsInRepoMock.mockResolvedValueOnce(true);
    expect(await moduleExists("book-1", "module-1")).toBe(true);
    expect(moduleExistsInRepoMock).toHaveBeenCalledWith("book-1", "module-1");
  });
});

describe("listModulesService", () => {
  it("returns not-found when the Book doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await listModulesService("book-1");

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });
    expect(listModulesByIdsMock).not.toHaveBeenCalled();
  });

  it("lists modules in Book.modules order", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    listModulesByIdsMock.mockResolvedValueOnce([validModule]);

    const result = await listModulesService("book-1");

    expect(listModulesByIdsMock).toHaveBeenCalledWith("book-1", ["module-1"]);
    expect(result).toEqual({ ok: true, value: [validModule] });
  });
});

describe("createModuleService", () => {
  it("returns not-found when the Book doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await createModuleService(
      "book-1",
      { title: { ar: "أ", en: "a" } },
      "admin@example.com",
    );

    expect(result.ok).toBe(false);
    expect(createModuleInRepoMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for a missing required field", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });

    const result = await createModuleService("book-1", {}, "admin@example.com");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(createModuleInRepoMock).not.toHaveBeenCalled();
  });

  it("creates the module on valid input", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    createModuleInRepoMock.mockResolvedValueOnce(validModule);

    const result = await createModuleService(
      "book-1",
      {
        title: { ar: "أ", en: "a" },
        description: { ar: "أ", en: "a" },
        color: "#fff",
        isLocked: false,
        isPublished: false,
      },
      "admin@example.com",
    );

    expect(result).toEqual({ ok: true, value: validModule });
  });
});

describe("getModuleByIdService", () => {
  it("returns invalid-input for a malformed id", async () => {
    const result = await getModuleByIdService("book-1", "a/b");
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the module doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    getModuleByIdFromRepoMock.mockResolvedValueOnce(null);

    const result = await getModuleByIdService("book-1", "module-1");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "not-found" }),
    });
  });
});

describe("updateModuleService", () => {
  it("maps the repository's 'invalid-reorder' outcome to an invalid-input error", async () => {
    // Permutation validity is re-checked against the live array inside the
    // repository's transaction (see lib/modules/modules-repository.ts), not
    // pre-validated here -- that's what closes the race against a
    // concurrent Lesson create/delete. This service test only needs to
    // verify the sentinel gets mapped to the right service error.
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    updateModuleByIdMock.mockResolvedValueOnce("invalid-reorder");

    const result = await updateModuleService(
      "book-1",
      "module-1",
      { lessons: ["unknown-lesson"] },
      "admin@example.com",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
  });

  it("accepts a valid lessons permutation and writes it", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    getModuleByIdFromRepoMock.mockResolvedValueOnce({
      ...validModule,
      lessons: ["a", "b"],
    });
    updateModuleByIdMock.mockResolvedValueOnce(validModule);

    const result = await updateModuleService(
      "book-1",
      "module-1",
      { lessons: ["b", "a"] },
      "admin@example.com",
    );

    expect(updateModuleByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ lessonsReorder: ["b", "a"] }),
    );
    expect(result).toEqual({ ok: true, value: validModule });
  });
});

describe("deleteModuleService", () => {
  it("returns conflict when the module still has lessons", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    getModuleByIdFromRepoMock.mockResolvedValueOnce({
      ...validModule,
      lessons: ["lesson-1"],
    });

    const result = await deleteModuleService(
      "book-1",
      "module-1",
      "a@example.com",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "conflict" }),
    });
    expect(deleteModuleByIdMock).not.toHaveBeenCalled();
  });

  it("returns conflict when the module still has questions", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    getModuleByIdFromRepoMock.mockResolvedValueOnce({
      ...validModule,
      lessons: [],
    });
    anyQuestionExistsMock.mockResolvedValueOnce(true);

    const result = await deleteModuleService(
      "book-1",
      "module-1",
      "a@example.com",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "conflict" }),
    });
    expect(deleteModuleByIdMock).not.toHaveBeenCalled();
  });

  it("deletes any referencing Materials before deleting the module, rather than blocking on them (ANA-77)", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    getModuleByIdFromRepoMock.mockResolvedValueOnce({
      ...validModule,
      lessons: [],
    });
    anyQuestionExistsMock.mockResolvedValueOnce(false);
    deleteModuleByIdMock.mockResolvedValueOnce(true);

    const result = await deleteModuleService(
      "book-1",
      "module-1",
      "a@example.com",
    );

    expect(deleteMaterialsByModuleMock).toHaveBeenCalledWith(
      "book-1",
      "module-1",
    );
    expect(deleteModuleByIdMock).toHaveBeenCalledWith(
      "book-1",
      "module-1",
      "a@example.com",
    );
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("deletes the module when it has no lessons or questions, and nothing references it", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validBook,
    });
    getModuleByIdFromRepoMock.mockResolvedValueOnce({
      ...validModule,
      lessons: [],
    });
    anyQuestionExistsMock.mockResolvedValueOnce(false);
    deleteModuleByIdMock.mockResolvedValueOnce(true);

    const result = await deleteModuleService(
      "book-1",
      "module-1",
      "a@example.com",
    );

    expect(result).toEqual({ ok: true, value: undefined });
  });
});
