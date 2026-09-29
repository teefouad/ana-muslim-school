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
    refineLearningMaterialMock.mockResolvedValueOnce({ ar: "Drafted text" });

    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "   ",
    });

    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
    expect(result).toEqual({ ok: true, value: { ar: "Drafted text" } });
  });

  it("returns the Book service's not-found error and never calls the AI helper when the Book doesn't exist", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await assistLearningMaterialService({
      bookId: "missing-book",
      text: "Module text",
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
    refineLearningMaterialMock.mockResolvedValueOnce({ ar: "Refined text" });

    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
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
      undefined,
      "Use more headings",
      false,
    );
    expect(result).toEqual({ ok: true, value: { ar: "Refined text" } });
  });

  it("treats whitespace-only additional instructions as absent", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce({ ar: "Refined text" });

    await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      additionalInstructions: "   ",
    });

    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Module text",
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      false,
    );
  });

  it("parses moduleTitle/moduleDescription and passes them through as this Module's own Arabic context (ANA-98/ANA-99)", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce({ ar: "Refined text" });

    await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      moduleTitle: "عنوان الوحدة",
      moduleDescription: "وصف الوحدة",
    });

    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Module text",
      expect.anything(),
      { title: "عنوان الوحدة", description: "وصف الوحدة" },
      undefined,
      undefined,
      false,
    );
  });

  it("returns invalid-input when moduleTitle is not a string", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      moduleTitle: { ar: "only-arabic", en: "" },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when moduleDescription is not a string", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      moduleDescription: 42,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("passes fullMaterial through as selection-surrounding context (ANA-99)", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce({ ar: "Refined excerpt" });

    await assistLearningMaterialService({
      bookId: "book-1",
      text: "Selected excerpt",
      fullMaterial: "The complete Learning Material",
    });

    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Selected excerpt",
      expect.anything(),
      expect.anything(),
      "The complete Learning Material",
      undefined,
      false,
    );
  });

  it("returns invalid-input when fullMaterial is not a string", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      fullMaterial: 42,
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
      }),
    ).rejects.toThrow("boom");
  });
  it("passes bilingual: true through to the helper and returns both languages (ANA-135)", async () => {
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: SAMPLE_BOOK,
    });
    refineLearningMaterialMock.mockResolvedValueOnce({
      ar: "نص",
      en: "Text",
    });

    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      bilingual: true,
    });

    expect(refineLearningMaterialMock).toHaveBeenCalledWith(
      "Module text",
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      true,
    );
    expect(result).toEqual({ ok: true, value: { ar: "نص", en: "Text" } });
  });

  it("returns invalid-input when bilingual is not a boolean", async () => {
    const result = await assistLearningMaterialService({
      bookId: "book-1",
      text: "Module text",
      bilingual: "yes",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });
});
