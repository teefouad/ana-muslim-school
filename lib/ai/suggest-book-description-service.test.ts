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

  it("allows empty text -- bookTitle/bookLongDescription context alone may be enough to suggest a description", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce("Suggested description");

    const result = await suggestBookDescriptionService({
      text: "",
      bookTitle: "عنوان",
      bookLongDescription: "وصف طويل",
    });

    expect(result).toEqual({
      ok: true,
      value: { text: "Suggested description" },
    });
  });

  it("never loads a Book server-side -- calls the helper directly with the request body's own fields", async () => {
    suggestBookDescriptionMock.mockResolvedValueOnce("Suggested description");

    const result = await suggestBookDescriptionService({
      text: "وصف حالي",
      bookTitle: "عنوان",
      bookLongDescription: "وصف طويل",
      additionalInstructions: "  Make it shorter  ",
    });

    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
      "وصف حالي",
      "عنوان",
      "وصف طويل",
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
      additionalInstructions: "   ",
    });

    expect(suggestBookDescriptionMock).toHaveBeenCalledWith(
      "",
      "",
      "",
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
