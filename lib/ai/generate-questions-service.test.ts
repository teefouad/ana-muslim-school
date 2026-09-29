import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateQuestionsMock } = vi.hoisted(() => ({
  generateQuestionsMock: vi.fn(),
}));

vi.mock("./generate-questions", () => ({
  generateQuestions: generateQuestionsMock,
}));

const { generateQuestionsService } =
  await import("./generate-questions-service");
const { AiTaskError } = await import("./run-ai-task");

const SAMPLE_QUESTIONS = [
  {
    text: "سؤال؟",
    explanation: "شرح",
    choices: [
      { text: "خطأ", isCorrect: false },
      { text: "صحيح", isCorrect: true },
    ],
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("generateQuestionsService", () => {
  it("returns invalid-input when sourceText is missing or empty", async () => {
    const result = await generateQuestionsService({ count: 5 });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(generateQuestionsMock).not.toHaveBeenCalled();

    const blank = await generateQuestionsService({
      sourceText: "   ",
      count: 5,
    });
    expect(blank).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
  });

  it("returns invalid-input when count is missing, not an integer, or out of range", async () => {
    const missing = await generateQuestionsService({ sourceText: "نص" });
    expect(missing).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const notInteger = await generateQuestionsService({
      sourceText: "نص",
      count: 2.5,
    });
    expect(notInteger).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const tooLow = await generateQuestionsService({
      sourceText: "نص",
      count: 0,
    });
    expect(tooLow).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    const tooHigh = await generateQuestionsService({
      sourceText: "نص",
      count: 21,
    });
    expect(tooHigh).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });

    expect(generateQuestionsMock).not.toHaveBeenCalled();
  });

  it("delegates the source text, count, and trimmed additional instructions", async () => {
    generateQuestionsMock.mockResolvedValueOnce(SAMPLE_QUESTIONS);

    const result = await generateQuestionsService({
      sourceText: "نص المصدر",
      count: 5,
      additionalInstructions: "  ركز على الفقرة الأولى  ",
    });

    expect(generateQuestionsMock).toHaveBeenCalledWith(
      "نص المصدر",
      5,
      "ركز على الفقرة الأولى",
      undefined,
    );
    expect(result).toEqual({
      ok: true,
      value: { questions: SAMPLE_QUESTIONS },
    });
  });

  it("omits additionalInstructions when left blank", async () => {
    generateQuestionsMock.mockResolvedValueOnce(SAMPLE_QUESTIONS);

    await generateQuestionsService({ sourceText: "نص المصدر", count: 5 });

    expect(generateQuestionsMock).toHaveBeenCalledWith(
      "نص المصدر",
      5,
      undefined,
      undefined,
    );
  });

  it("maps an AiTaskError to an upstream-error, without leaking its message", async () => {
    generateQuestionsMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    const result = await generateQuestionsService({
      sourceText: "نص المصدر",
      count: 5,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "upstream-error" }),
    });
  });

  it("rethrows an unexpected, non-AI error", async () => {
    generateQuestionsMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      generateQuestionsService({ sourceText: "نص المصدر", count: 5 }),
    ).rejects.toThrow("boom");
  });
});
