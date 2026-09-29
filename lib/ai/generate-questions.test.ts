import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAiTaskMock } = vi.hoisted(() => ({ runAiTaskMock: vi.fn() }));

vi.mock("./run-ai-task", async () => {
  const actual =
    await vi.importActual<typeof import("./run-ai-task")>("./run-ai-task");
  return { ...actual, runAiTask: runAiTaskMock };
});

const { generateQuestions } = await import("./generate-questions");
const { AiTaskError } = await import("./run-ai-task");

const ONE_GENERATED_QUESTION = JSON.stringify({
  questions: [
    {
      text: { ar: "سؤال؟", en: "Question?" },
      explanation: { ar: "شرح", en: "Explanation" },
      choices: [
        { text: { ar: "خطأ", en: "Wrong" }, isCorrect: false },
        { text: { ar: "صحيح", en: "Right" }, isCorrect: true },
      ],
    },
  ],
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("generateQuestions", () => {
  it("requests Structured Outputs via a json_schema responseFormat", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    await generateQuestions("نص المصدر", 1);

    expect(runAiTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: expect.objectContaining({
          name: expect.any(String),
          schema: expect.objectContaining({ type: "object" }),
        }),
      }),
    );
  });

  it("includes the requested count and the source text, clearly delimited", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    await generateQuestions("نص المصدر", 3);

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/exactly 3/);
    expect(input).toMatch(/نص المصدر/);
    expect(input).toMatch(/Source text/);
  });

  it("passes additional instructions through separately", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    await generateQuestions("نص المصدر", 1, "ركز على الفقرة الأولى");

    expect(runAiTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalInstructions: "ركز على الفقرة الأولى",
      }),
    );
  });

  it("uses a fixed base prompt that requires both languages, each held to the constraints on its own, and forbids inventing facts", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    await generateQuestions("نص المصدر", 1);

    const basePrompt: string = runAiTaskMock.mock.calls[0][0].basePrompt;
    expect(basePrompt).toMatch(/do not introduce islamic rulings/i);
    expect(basePrompt).toMatch(/both Arabic \("ar"\) and English \("en"\)/);
    expect(basePrompt).toMatch(
      /applies to the Arabic result AND to\s+the English result/,
    );
    expect(basePrompt).toMatch(/exactly one correct choice/i);
  });

  it("returns the parsed questions on a well-formed response", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    const result = await generateQuestions("نص المصدر", 1);

    expect(result).toEqual([
      {
        text: { ar: "سؤال؟", en: "Question?" },
        explanation: { ar: "شرح", en: "Explanation" },
        choices: [
          { text: { ar: "خطأ", en: "Wrong" }, isCorrect: false },
          { text: { ar: "صحيح", en: "Right" }, isCorrect: true },
        ],
      },
    ]);
  });

  it("rejects a response that isn't valid JSON", async () => {
    runAiTaskMock.mockResolvedValueOnce("not json");

    await expect(generateQuestions("نص المصدر", 1)).rejects.toBeInstanceOf(
      AiTaskError,
    );
  });

  it("rejects a response missing the questions array", async () => {
    runAiTaskMock.mockResolvedValueOnce(JSON.stringify({}));

    await expect(generateQuestions("نص المصدر", 1)).rejects.toBeInstanceOf(
      AiTaskError,
    );
  });

  it("rejects a response whose questions don't match the expected shape", async () => {
    runAiTaskMock.mockResolvedValueOnce(
      JSON.stringify({ questions: [{ text: "سؤال؟" }] }),
    );

    await expect(generateQuestions("نص المصدر", 1)).rejects.toBeInstanceOf(
      AiTaskError,
    );
  });

  it("rejects a question whose text is only in one language (ANA-135)", async () => {
    runAiTaskMock.mockResolvedValueOnce(
      JSON.stringify({
        questions: [
          {
            text: "سؤال؟",
            explanation: { ar: "شرح", en: "Explanation" },
            choices: [],
          },
        ],
      }),
    );

    await expect(generateQuestions("نص المصدر", 1)).rejects.toBeInstanceOf(
      AiTaskError,
    );
  });

  it("propagates an AiTaskError from the shared executor", async () => {
    runAiTaskMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    await expect(generateQuestions("نص المصدر", 1)).rejects.toBeInstanceOf(
      AiTaskError,
    );
  });
});
