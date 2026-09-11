import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookByIdServiceMock, translateModuleFieldMock } = vi.hoisted(() => ({
  getBookByIdServiceMock: vi.fn(),
  translateModuleFieldMock: vi.fn(),
}));

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
}));

vi.mock("./translate-module-field", () => ({
  translateModuleField: translateModuleFieldMock,
}));

const { translateModuleFieldService } =
  await import("./translate-module-field-service");
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("translateModuleFieldService", () => {
  it("returns invalid-input when text is missing", async () => {
    const result = await translateModuleFieldService({
      field: "title",
      bookId: "book-1",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for empty/whitespace-only text", async () => {
    const result = await translateModuleFieldService({
      text: "   ",
      field: "title",
      bookId: "book-1",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
  });

  it("returns invalid-input for an unrecognized field", async () => {
    const result = await translateModuleFieldService({
      text: "النص",
      field: "color",
      bookId: "book-1",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when bookId is missing", async () => {
    const result = await translateModuleFieldService({
      text: "النص",
      field: "title",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when a supplied moduleTitle/moduleDescription/moduleContent isn't a string (ANA-99)", async () => {
    const badTitle = await translateModuleFieldService({
      text: "النص",
      field: "title",
      bookId: "book-1",
      moduleTitle: { ar: "عنوان", en: "" },
    });
    expect(badTitle).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const badDescription = await translateModuleFieldService({
      text: "النص",
      field: "title",
      bookId: "book-1",
      moduleDescription: { ar: "only-arabic" },
    });
    expect(badDescription).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const badContent = await translateModuleFieldService({
      text: "النص",
      field: "title",
      bookId: "book-1",
      moduleContent: 42,
    });
    expect(badContent).toEqual({
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

    const result = await translateModuleFieldService({
      text: "النص",
      field: "title",
      bookId: "missing-book",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });
    expect(translateModuleFieldMock).not.toHaveBeenCalled();
  });

  it("loads the Book server-side and calls the helper with field, Book context, optional Module context, and additionalInstructions", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    translateModuleFieldMock.mockResolvedValueOnce("Translated text");

    const moduleContent = "محتوى الوحدة";

    const result = await translateModuleFieldService({
      text: "النص العربي",
      field: "title",
      bookId: "book-1",
      moduleContent,
      additionalInstructions: "  Keep it short  ",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
    expect(translateModuleFieldMock).toHaveBeenCalledWith(
      "النص العربي",
      "title",
      {
        title: SAMPLE_BOOK.title,
        description: SAMPLE_BOOK.description,
        longDescription: SAMPLE_BOOK.longDescription,
      },
      { title: undefined, description: undefined, content: moduleContent },
      "Keep it short",
    );
    expect(result).toEqual({ ok: true, value: { text: "Translated text" } });
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    translateModuleFieldMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await translateModuleFieldService({
      text: "النص",
      field: "title",
      bookId: "book-1",
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
    translateModuleFieldMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      translateModuleFieldService({
        text: "النص",
        field: "title",
        bookId: "book-1",
      }),
    ).rejects.toThrow("boom");
  });
});
