import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookByIdServiceMock, suggestModuleDescriptionMock } = vi.hoisted(
  () => ({
    getBookByIdServiceMock: vi.fn(),
    suggestModuleDescriptionMock: vi.fn(),
  }),
);

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
}));

vi.mock("./suggest-module-description", () => ({
  suggestModuleDescription: suggestModuleDescriptionMock,
}));

const { suggestModuleDescriptionService } =
  await import("./suggest-module-description-service");
const { AiTaskError } = await import("./run-ai-task");

const SAMPLE_BOOK = {
  id: "book-1",
  title: { ar: "عنوان", en: "Title" },
  description: { ar: "وصف", en: "Description" },
  longDescription: { ar: "وصف طويل", en: "Long description" },
  color: "#000000",
  imageId: "img-1",
  modules: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "a@example.com",
  updatedBy: "a@example.com",
};

const MODULE_TITLE = "عنوان الوحدة";
const MODULE_CONTENT = "محتوى الوحدة";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("suggestModuleDescriptionService", () => {
  it("returns invalid-input when bookId is missing", async () => {
    const result = await suggestModuleDescriptionService({
      text: "",
      moduleTitle: MODULE_TITLE,
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("allows empty text -- moduleTitle/moduleContent context alone may be enough to suggest a description", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleDescriptionMock.mockResolvedValueOnce({
      ar: "وصف",
      en: "Suggested description",
    });

    const result = await suggestModuleDescriptionService({
      bookId: "book-1",
      text: "",
      moduleTitle: MODULE_TITLE,
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: true,
      value: { ar: "وصف", en: "Suggested description" },
    });
  });

  it("returns invalid-input when moduleTitle is missing or not a string", async () => {
    const result = await suggestModuleDescriptionService({
      bookId: "book-1",
      text: "",
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();

    const badType = await suggestModuleDescriptionService({
      bookId: "book-1",
      text: "",
      moduleTitle: { ar: "عنوان", en: "" },
      moduleContent: MODULE_CONTENT,
    });

    expect(badType).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
  });

  it("returns invalid-input when moduleContent is missing or not a string", async () => {
    const result = await suggestModuleDescriptionService({
      bookId: "book-1",
      text: "",
      moduleTitle: MODULE_TITLE,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns the Book service's not-found error and never calls the AI helper when the Book doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await suggestModuleDescriptionService({
      bookId: "missing-book",
      text: "",
      moduleTitle: MODULE_TITLE,
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });
    expect(suggestModuleDescriptionMock).not.toHaveBeenCalled();
  });

  it("loads the Book server-side and calls the helper with the current description, moduleTitle, moduleContent, and Book context", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleDescriptionMock.mockResolvedValueOnce({
      ar: "وصف",
      en: "Suggested description",
    });

    const result = await suggestModuleDescriptionService({
      bookId: "book-1",
      text: "Current description",
      moduleTitle: MODULE_TITLE,
      moduleContent: MODULE_CONTENT,
      additionalInstructions: "  Make it shorter  ",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
    expect(suggestModuleDescriptionMock).toHaveBeenCalledWith(
      "Current description",
      MODULE_TITLE,
      MODULE_CONTENT,
      {
        title: SAMPLE_BOOK.title,
        description: SAMPLE_BOOK.description,
        longDescription: SAMPLE_BOOK.longDescription,
      },
      "Make it shorter",
    );
    expect(result).toEqual({
      ok: true,
      value: { ar: "وصف", en: "Suggested description" },
    });
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleDescriptionMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await suggestModuleDescriptionService({
      bookId: "book-1",
      text: "",
      moduleTitle: MODULE_TITLE,
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "upstream-error" }),
    });
  });

  it("rethrows an unexpected, non-AI error", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleDescriptionMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      suggestModuleDescriptionService({
        bookId: "book-1",
        text: "",
        moduleTitle: MODULE_TITLE,
        moduleContent: MODULE_CONTENT,
      }),
    ).rejects.toThrow("boom");
  });
});
