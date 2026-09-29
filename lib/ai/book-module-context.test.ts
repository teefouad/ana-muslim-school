import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookByIdServiceMock, listModulesByIdsMock, listMaterialsMock } =
  vi.hoisted(() => ({
    getBookByIdServiceMock: vi.fn(),
    listModulesByIdsMock: vi.fn(),
    listMaterialsMock: vi.fn(),
  }));

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
}));
vi.mock("@/lib/modules/modules-repository", () => ({
  listModulesByIds: listModulesByIdsMock,
}));
vi.mock("@/lib/materials/materials-repository", () => ({
  listMaterials: listMaterialsMock,
}));

const { appendModuleContext, loadBookModuleContext, readModuleSelection } =
  await import("./book-module-context");

const makeModule = (id: string, title: string, description = "") => ({
  id,
  title: { ar: title, en: "" },
  description: { ar: description, en: "" },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("readModuleSelection", () => {
  it("returns null when moduleIds is omitted or empty", () => {
    expect(readModuleSelection({})).toEqual({ ok: true, value: null });
    expect(readModuleSelection({ moduleIds: [] })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("rejects a non-array or non-string moduleIds", () => {
    for (const moduleIds of ["m1", [1], [""]]) {
      expect(readModuleSelection({ bookId: "b", moduleIds })).toMatchObject({
        ok: false,
        error: { code: "invalid-input" },
      });
    }
  });

  it("requires bookId when moduleIds is non-empty", () => {
    expect(readModuleSelection({ moduleIds: ["m1"] })).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
  });

  it("returns de-duplicated ids with the bookId", () => {
    expect(
      readModuleSelection({ bookId: "b", moduleIds: ["m1", "m1", "m2"] }),
    ).toEqual({ ok: true, value: { bookId: "b", moduleIds: ["m1", "m2"] } });
  });
});

describe("loadBookModuleContext", () => {
  it("rejects modules that don't belong to the Book, without loading them", async () => {
    getBookByIdServiceMock.mockResolvedValue({
      ok: true,
      value: { modules: ["m1"] },
    });

    const result = await loadBookModuleContext({
      bookId: "b",
      moduleIds: ["m1", "other"],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
    expect(listModulesByIdsMock).not.toHaveBeenCalled();
  });

  it("passes through a missing Book", async () => {
    getBookByIdServiceMock.mockResolvedValue({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    expect(
      await loadBookModuleContext({ bookId: "b", moduleIds: ["m1"] }),
    ).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("includes only the selected modules' Arabic title, description, and material", async () => {
    getBookByIdServiceMock.mockResolvedValue({
      ok: true,
      value: { modules: ["m1", "m2"] },
    });
    listModulesByIdsMock.mockResolvedValue([
      makeModule("m2", "الوحدة", "وصفها"),
    ]);
    listMaterialsMock.mockResolvedValue([
      { moduleId: "m1", content: { ar: "محتوى غير مختار", en: "" } },
      { moduleId: "m2", content: { ar: "محتوى مختار", en: "English" } },
    ]);

    const result = await loadBookModuleContext({
      bookId: "b",
      moduleIds: ["m2"],
    });

    expect(listModulesByIdsMock).toHaveBeenCalledWith("b", ["m2"]);
    expect(result.ok && result.value).toContain("الوحدة");
    expect(result.ok && result.value).toContain("وصفها");
    expect(result.ok && result.value).toContain("محتوى مختار");
    expect(result.ok && result.value).not.toContain("محتوى غير مختار");
    expect(result.ok && result.value).not.toContain("English");
  });

  it("caps the total context size", async () => {
    getBookByIdServiceMock.mockResolvedValue({
      ok: true,
      value: { modules: ["m1", "m2"] },
    });
    listModulesByIdsMock.mockResolvedValue([
      makeModule("m1", "a"),
      makeModule("m2", "b"),
    ]);
    listMaterialsMock.mockResolvedValue([
      { moduleId: "m1", content: { ar: "x".repeat(50_000), en: "" } },
      { moduleId: "m2", content: { ar: "y".repeat(50_000), en: "" } },
    ]);

    const result = await loadBookModuleContext({
      bookId: "b",
      moduleIds: ["m1", "m2"],
    });

    expect(result.ok && result.value.length).toBeLessThan(61_000);
  });
});

describe("appendModuleContext", () => {
  it("adds a delimited section only when there is context", () => {
    const empty: string[] = [];
    appendModuleContext(empty, "  ");
    expect(empty).toEqual([]);

    const sections: string[] = [];
    appendModuleContext(sections, "### A");
    expect(sections.join("\n")).toMatch(/=== Selected Modules/);
    expect(sections.join("\n")).toMatch(/### A/);
  });
});
