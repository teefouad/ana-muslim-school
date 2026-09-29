import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookByIdServiceMock, suggestModuleTitleMock } = vi.hoisted(() => ({
  getBookByIdServiceMock: vi.fn(),
  suggestModuleTitleMock: vi.fn(),
}));

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
}));

vi.mock("./suggest-module-title", () => ({
  suggestModuleTitle: suggestModuleTitleMock,
}));

const { suggestModuleTitleService } =
  await import("./suggest-module-title-service");
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

const MODULE_CONTENT = "محتوى الوحدة";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("suggestModuleTitleService", () => {
  it("returns invalid-input when bookId is missing", async () => {
    const result = await suggestModuleTitleService({
      text: "",
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when text is not a string", async () => {
    const result = await suggestModuleTitleService({
      bookId: "book-1",
      text: 42,
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
  });

  it("allows empty text -- moduleContent context alone may be enough to suggest a title", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleTitleMock.mockResolvedValueOnce("Suggested title");

    const result = await suggestModuleTitleService({
      bookId: "book-1",
      text: "",
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({ ok: true, value: { text: "Suggested title" } });
  });

  it("returns invalid-input when moduleContent is missing or not a string", async () => {
    const result = await suggestModuleTitleService({
      bookId: "book-1",
      text: "",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();

    const badType = await suggestModuleTitleService({
      bookId: "book-1",
      text: "",
      moduleContent: { ar: "محتوى", en: "" },
    });

    expect(badType).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
  });

  it("returns the Book service's not-found error and never calls the AI helper when the Book doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await suggestModuleTitleService({
      bookId: "missing-book",
      text: "",
      moduleContent: MODULE_CONTENT,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });
    expect(suggestModuleTitleMock).not.toHaveBeenCalled();
  });

  it("loads the Book server-side and calls the helper with the current title, moduleContent, and Book context", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleTitleMock.mockResolvedValueOnce("Suggested title");

    const result = await suggestModuleTitleService({
      bookId: "book-1",
      text: "Current title",
      moduleContent: MODULE_CONTENT,
      additionalInstructions: "  Make it shorter  ",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
    expect(suggestModuleTitleMock).toHaveBeenCalledWith(
      "Current title",
      MODULE_CONTENT,
      {
        title: SAMPLE_BOOK.title,
        description: SAMPLE_BOOK.description,
        longDescription: SAMPLE_BOOK.longDescription,
      },
      "Make it shorter",
      undefined,
    );
    expect(result).toEqual({ ok: true, value: { text: "Suggested title" } });
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    suggestModuleTitleMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await suggestModuleTitleService({
      bookId: "book-1",
      text: "",
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
    suggestModuleTitleMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      suggestModuleTitleService({
        bookId: "book-1",
        text: "",
        moduleContent: MODULE_CONTENT,
      }),
    ).rejects.toThrow("boom");
  });
});
