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
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
  });

  it.each(["textEn", "bookTitleEn", "bookDescriptionEn"])(
    "returns invalid-input when the optional English sibling `%s` isn't a string (ANA-135)",
    async (field) => {
      const result = await suggestBookLongDescriptionService({
        text: "",
        bookTitle: "",
        bookDescription: "",
        [field]: 42,
      });

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "invalid-input" }),
      });
      expect(suggestBookLongDescriptionMock).not.toHaveBeenCalled();
    },
  );

  it("allows empty text -- bookTitle/bookDescription context alone may be enough to suggest a long description", async () => {
    suggestBookLongDescriptionMock.mockResolvedValueOnce({
      ar: "نص",
      en: "Text",
    });

    const result = await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "عنوان",
      bookDescription: "وصف",
    });

    expect(result).toEqual({
      ok: true,
      value: { ar: "نص", en: "Text" },
    });
  });

  it("never loads a Book server-side -- calls the helper directly with the request body's own fields, in both languages", async () => {
    suggestBookLongDescriptionMock.mockResolvedValueOnce({
      ar: "نص",
      en: "Text",
    });

    const result = await suggestBookLongDescriptionService({
      text: "وصف طويل حالي",
      textEn: "Current",
      bookTitle: "عنوان",
      bookTitleEn: "Title",
      bookDescription: "وصف",
      bookDescriptionEn: "Short",
      additionalInstructions: "  Make it shorter  ",
    });

    expect(suggestBookLongDescriptionMock).toHaveBeenCalledWith(
      { ar: "وصف طويل حالي", en: "Current" },
      { ar: "عنوان", en: "Title" },
      { ar: "وصف", en: "Short" },
      "Make it shorter",
      undefined,
    );
    expect(result).toEqual({
      ok: true,
      value: { ar: "نص", en: "Text" },
    });
    expect(loadBookModuleContextMock).not.toHaveBeenCalled();
  });

  it("loads the selected modules server-side and passes their content as context (ANA-133)", async () => {
    loadBookModuleContextMock.mockResolvedValueOnce({
      ok: true,
      value: "### وحدة",
    });
    suggestBookLongDescriptionMock.mockResolvedValueOnce({
      ar: "نص",
      en: "Text",
    });

    await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      bookId: "b1",
      moduleIds: ["m1"],
    });

    expect(loadBookModuleContextMock).toHaveBeenCalledWith({
      bookId: "b1",
      moduleIds: ["m1"],
    });
    expect(suggestBookLongDescriptionMock).toHaveBeenCalledWith(
      { ar: "", en: "" },
      { ar: "", en: "" },
      { ar: "", en: "" },
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
      moduleIds: ["m1"],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
  });

  it("treats whitespace-only additional instructions as absent", async () => {
    suggestBookLongDescriptionMock.mockResolvedValueOnce({
      ar: "نص",
      en: "Text",
    });

    await suggestBookLongDescriptionService({
      text: "",
      bookTitle: "",
      bookDescription: "",
      additionalInstructions: "   ",
    });

    expect(suggestBookLongDescriptionMock).toHaveBeenCalledWith(
      { ar: "", en: "" },
      { ar: "", en: "" },
      { ar: "", en: "" },
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
      }),
    ).rejects.toThrow("boom");
  });
});
