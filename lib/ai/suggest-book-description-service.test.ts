import { beforeEach, describe, expect, it, vi } from "vitest";

const { suggestBookDescriptionMock } = vi.hoisted(() => ({
  suggestBookDescriptionMock: vi.fn(),
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
      language: "ar",
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
      language: "ar",
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
      language: "ar",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for a language other than ar/en (PR review: AI Assistance must operate on the active language)", async () => {
    const missing = await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
    });
    expect(missing).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const invalid = await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
      language: "fr",
    });
    expect(invalid).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    expect(suggestBookDescriptionMock).not.toHaveBeenCalled();
  });

  it("allows empty text -- bookTitle/bookLongDescription context alone may be enough to suggest a description", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce("Suggested description");

    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "عنوان",
      bookLongDescription: "وصف طويل",
      language: "ar",
    });

    expect(result).toEqual({
      ok: true,
      value: { text: "Suggested description" },
    });
  });

  it("never loads a Book server-side -- calls the helper directly with the request body's own fields, including language", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce("Suggested description");

    const result = await suggestBookDescriptionService({
      text: "وصف حالي",
      bookTitle: "عنوان",
      bookLongDescription: "وصف طويل",
      language: "en",
      additionalInstructions: "  Make it shorter  ",
    });

    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
      "وصف حالي",
      "عنوان",
      "وصف طويل",
      "en",
      "Make it shorter",
    );
    expect(result).toEqual({
      ok: true,
      value: { text: "Suggested description" },
    });
  });

  it("treats whitespace-only additional instructions as absent", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce("Suggested description");

    await suggestBookDescriptionService({
      text: "",
      bookTitle: "",
      bookLongDescription: "",
      language: "ar",
      additionalInstructions: "   ",
    });

    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
      "",
      "",
      "",
      "ar",
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
      language: "ar",
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
        language: "ar",
      }),
    ).rejects.toThrow("boom");
  });
});
