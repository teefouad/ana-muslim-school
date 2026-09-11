import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookByIdServiceMock, refineLearningMaterialMock } = vi.hoisted(
  () => ({
    getBookByIdServiceMock: vi.fn(),
    refineLearningMaterialMock: vi.fn(),
  }),
);

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
}));

vi.mock("./refine-learning-material", () => ({
  refineLearningMaterial: refineLearningMaterialMock,
}));

const { assistLearningMaterialService } =
  await import("./assist-learning-material-service");
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

describe("assistLearningMaterialService", () => {
  it("returns invalid-input when bookId is missing", async () => {
    const result = await assistLearningMaterialService({
      text: "text",
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
    expect(refineLearningMaterialMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when bookId is not a string", async () => {
    const result = await assistLearningMaterialService({
      bookId: 42,
      text: "text",
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for a language other than ar/en", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "text",
      language: "fr",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when text is not a string", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: 42,
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("allows empty/whitespace-only text (ANA-98) -- Module/Book context alone may be enough to draft Learning Material", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce("Drafted text");

    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "   ",
      language: "ar",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
    expect(result).toEqual({ ok: true, value: { text: "Drafted text" } });
  });

  it("returns the Book service's not-found error and never calls the AI helper when the Book doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await assistLearningMaterialService({
      bookId: "missing-book",
      text: "Module text",
      language: "ar",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("missing-book");
    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });
    expect(refineLearningMaterialMock).not.toHaveBeenCalled();
  });

  it("loads the Book server-side from bookId and calls the specialized helper with its title/description/longDescription, separate from additionalInstructions", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce("Refined text");

    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      language: "ar",
      additionalInstructions: "  Use more headings  ",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Module text",
      {
        title: SAMPLE_BOOK.title,
        description: SAMPLE_BOOK.description,
        longDescription: SAMPLE_BOOK.longDescription,
      },
      { title: undefined, description: undefined },
      "Use more headings",
    );
    expect(result).toEqual({ ok: true, value: { text: "Refined text" } });
  });

  it("treats whitespace-only additional instructions as absent", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce("Refined text");

    await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      language: "en",
      additionalInstructions: "   ",
    });

    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Module text",
      expect.anything(),
      expect.anything(),
      undefined,
    );
  });

  it("parses moduleTitle/moduleDescription and passes them through as this Module's own context (ANA-98)", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce("Refined text");

    const moduleTitle = { ar: "عنوان الوحدة", en: "Module Title" };
    const moduleDescription = { ar: "وصف الوحدة", en: "Module Description" };

    await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      language: "ar",
      moduleTitle,
      moduleDescription,
    });

    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Module text",
      expect.anything(),
      { title: moduleTitle, description: moduleDescription },
      undefined,
    );
  });

  it("returns invalid-input when moduleTitle is not a valid { ar, en } object", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      language: "ar",
      moduleTitle: { ar: "only-arabic" },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when moduleDescription is not a valid { ar, en } object", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      language: "ar",
      moduleDescription: "not an object",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      language: "ar",
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
    refineLearningMaterialMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      assistLearningMaterialService({
        bookId: "book-1",
        text: "Module text",
        language: "ar",
      }),
    ).rejects.toThrow("boom");
  });
});
