import { beforeEach, describe, expect, it, vi } from "vitest";

const { translateArabicToEnglishMock } = vi.hoisted(() => ({
  translateArabicToEnglishMock: vi.fn(),
}));

vi.mock("./translate-arabic-to-english", () => ({
  translateArabicToEnglish: translateArabicToEnglishMock,
}));

const { translateArabicToEnglishService } = await import("./translate-service");
const { AiTaskError } = await import("./run-ai-task");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("translateArabicToEnglishService", () => {
  it("returns invalid-input when text is missing", async () => {
    const result = await translateArabicToEnglishService({});

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(translateArabicToEnglishMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input when text is not a string", async () => {
    const result = await translateArabicToEnglishService({ text: 42 });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(translateArabicToEnglishMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for an empty/whitespace-only string", async () => {
    const result = await translateArabicToEnglishService({ text: "   " });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(translateArabicToEnglishMock).not.toHaveBeenCalled();
  });

  it("delegates only to the specialized translateArabicToEnglish helper", async () => {
    translateArabicToEnglishMock.mockResolvedValueOnce("Translated text");

    const result = await translateArabicToEnglishService({
      text: "النص العربي",
    });

    expect(translateArabicToEnglishMock).toHaveBeenCalledWith("النص العربي");
    expect(translateArabicToEnglishMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, value: { text: "Translated text" } });
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    translateArabicToEnglishMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await translateArabicToEnglishService({
      text: "النص العربي",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "upstream-error" }),
    });
  });

  it("rethrows an unexpected, non-AI error", async () => {
    translateArabicToEnglishMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      translateArabicToEnglishService({ text: "النص العربي" }),
    ).rejects.toThrow("boom");
  });
});
