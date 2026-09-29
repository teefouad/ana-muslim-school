import { beforeEach, describe, expect, it, vi } from "vitest";

const { suggestBookDescriptionMock, loadBookModuleContextMock } = vi.hoisted(
  () => ({
    suggestBookDescriptionMock: vi.fn(),
    loadBookModuleContextMock: vi.fn(),
  }),
);

vi.mock("./book-module-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./book-module-context")>()),
  loadBookModuleContext: loadBookModuleContextMock,
}));

vi.mock("./suggest-book-description", () => ({
  suggestBookDescription: suggestBookDescriptionMock,
}));

const { suggestBookDescriptionService } =
  await import("./suggest-book-description-service");
const { AiTaskError } = await import("./run-ai-task");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("suggestBookDescriptionService", () => {
  it("returns invalid-input when text is not a string", async () => {
    const result = await suggestBookDescriptionService({
      text: 42,
      bookTitle: "",
      bookLongDescription: "",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when bookTitle is missing or not a string", async () => {
    const result = await suggestBookDescriptionService({
      text: "",
      bookLongDescription: "",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when bookLongDescription is missing or not a string", async () => {
    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
  });

  it.each(["textEn", "bookTitleEn", "bookLongDescriptionEn"])(
    "returns invalid-input when the optional English sibling `%s` isn't a string (ANA-135)",
    async (field) => {
      const result = await suggestBookDescriptionService({
        text: "",
        bookTitle: "",
        bookLongDescription: "",
        [field]: 42,
      });

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "invalid-input" }),
      });
      expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
    },
  );

  it("allows empty text -- bookTitle/bookLongDescription context alone may be enough to suggest a description", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce({ ar: "نص", en: "Text" });

    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "عنوان",
      bookLongDescription: "وصف طويل",
    });

    expect(result).toEqual({
      ok: true,
      value: { ar: "نص", en: "Text" },
    });
  });

  it("never loads a Book server-side -- calls the helper directly with the request body's own fields, in both languages", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce({ ar: "نص", en: "Text" });

    const result = await suggestBookDescriptionService({
      text: "وصف حالي",
      textEn: "Current",
      bookTitle: "عنوان",
      bookTitleEn: "Title",
      bookLongDescription: "وصف طويل",
      bookLongDescriptionEn: "Long",
      additionalInstructions: "  Make it shorter  ",
    });

    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
      { ar: "وصف حالي", en: "Current" },
      { ar: "عنوان", en: "Title" },
      { ar: "وصف طويل", en: "Long" },
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
    suggestBookDescriptionMock.mockResolvedValueOnce({ ar: "نص", en: "Text" });

    await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
      bookId: "b1",
      moduleIds: ["m1"],
    });

    expect(loadBookModuleContextMock).toHaveBeenCalledWith({
      bookId: "b1",
      moduleIds: ["m1"],
    });
    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
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

    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
      bookId: "b1",
      moduleIds: ["nope"],
    });

    expect(result).toMatchObject({ ok: false });
    expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
  });

  it("rejects moduleIds without a bookId (ANA-133)", async () => {
    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
      moduleIds: ["m1"],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
  });

  it("treats whitespace-only additional instructions as absent", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce({ ar: "نص", en: "Text" });

    await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
      additionalInstructions: "   ",
    });

    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
      { ar: "", en: "" },
      { ar: "", en: "" },
      { ar: "", en: "" },
      undefined,
      undefined,
    );
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    suggestBookDescriptionMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "upstream-error" }),
    });
  });

  it("rethrows an unexpected, non-AI error", async () => {
    suggestBookDescriptionMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      suggestBookDescriptionService({
        text: "",
        bookTitle: "",
        bookLongDescription: "",
      }),
    ).rejects.toThrow("boom");
  });
});
