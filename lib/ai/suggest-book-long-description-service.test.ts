import { beforeEach, describe, expect, it, vi } from "vitest";

const { suggestBookLongDescriptionMock, loadBookModuleContextMock } =
  vi.hoisted(() => ({
    suggestBookLongDescriptionMock: vi.fn(),
    loadBookModuleContextMock: vi.fn(),
  }));

vi.mock("./book-module-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./book-module-context")>()),
  loadBookModuleContext: loadBookModuleContextMock,
}));

vi.mock("./suggest-book-long-description", () => ({
  suggestBookLongDescription: suggestBookLongDescriptionMock,
}));

const { suggestBookLongDescriptionService } =
  await import("./suggest-book-long-description-service");
const { AiTaskError } = await import("./run-ai-task");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("suggestBookLongDescriptionService", () => {
  it("returns invalid-input when text is not a string", async () => {
    const result = await suggestBookLongDescriptionService({
      text: 42,
      bookTitle: "",
      bookDescription: "",
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when bookTitle is missing or not a string", async () => {
    const result = await suggestBookLongDescriptionService({
      text: "",
      bookDescription: "",
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when bookDescription is missing or not a string", async () => {
    const result = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for a language other than ar/en (PR review: AI Assistance must operate on the active language)", async () => {
    const missing = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
    });
    expect(missing).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const invalid = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      language: "fr",
    });
    expect(invalid).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
  });

  it("allows empty text -- bookTitle/bookDescription context alone may be enough to suggest a long description", async () => {
    suggestBookLongDescriptionMock.mockResolvedValueOnce(
      "Suggested long description",
    );

    const result = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "عنوان",
      bookDescription: "وصف",
      language: "ar",
    });

    expect(result).toEqual({
      ok: true,
      value: { text: "Suggested long description" },
    });
  });

  it("never loads a Book server-side -- calls the helper directly with the request body's own fields, including language", async () => {
    suggestBookLongDescriptionMock.mockResolvedValueOnce(
      "Suggested long description",
    );

    const result = await suggestBookLongDescriptionService({
      text: "وصف طويل حالي",
      bookTitle: "عنوان",
      bookDescription: "وصف",
      language: "en",
      additionalInstructions: "  Make it shorter  ",
    });

    expect(suggestBookLongDescriptionMock).toHaveBeenCalledWith(
      "وصف طويل حالي",
      "عنوان",
      "وصف",
      "en",
      "Make it shorter",
      undefined,
    );
    expect(result).toEqual({
      ok: true,
      value: { text: "Suggested long description" },
    });
    expect(loadBookModuleContextMock).not.toHaveBeenCalled();
  });

  it("loads the selected modules server-side and passes their content as context (ANA-133)", async () => {
    loadBookModuleContextMock.mockResolvedValueOnce({
      ok: true,
      value: "### وحدة",
    });
    suggestBookLongDescriptionMock.mockResolvedValueOnce("text");

    await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      language: "ar",
      bookId: "b1",
      moduleIds: ["m1"],
    });

    expect(loadBookModuleContextMock).toHaveBeenCalledWith({
      bookId: "b1",
      moduleIds: ["m1"],
    });
    expect(suggestBookLongDescriptionMock).toHaveBeenCalledWith(
      "",
      "",
      "",
      "ar",
      undefined,
      "### وحدة",
    );
  });

  it("returns the loader's error, without calling the AI, when the modules are invalid (ANA-133)", async () => {
    loadBookModuleContextMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "invalid-input", message: "bad modules" },
    });

    const result = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      language: "ar",
      bookId: "b1",
      moduleIds: ["nope"],
    });

    expect(result).toMatchObject({ ok: false });
    expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
  });

  it("rejects moduleIds without a bookId (ANA-133)", async () => {
    const result = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      language: "ar",
      moduleIds: ["m1"],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
  });

  it("treats whitespace-only additional instructions as absent", async () => {
    suggestBookLongDescriptionMock.mockResolvedValueOnce(
      "Suggested long description",
    );

    await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      language: "ar",
      additionalInstructions: "   ",
    });

    expect(suggestBookLongDescriptionMock).toHaveBeenCalledWith(
      "",
      "",
      "",
      "ar",
      undefined,
      undefined,
    );
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    suggestBookLongDescriptionMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "upstream-error" }),
    });
  });

  it("rethrows an unexpected, non-AI error", async () => {
    suggestBookLongDescriptionMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      suggestBookLongDescriptionService({
        text: "",
        bookTitle: "",
        bookDescription: "",
        language: "ar",
      }),
    ).rejects.toThrow("boom");
  });
});
