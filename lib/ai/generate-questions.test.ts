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
      text: "سؤال؟",
      explanation: "شرح",
      choices: [
        { text: "خطأ", isCorrect: false },
        { text: "صحيح", isCorrect: true },
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

  it("uses a fixed base prompt that requires Arabic output and forbids inventing facts", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    await generateQuestions("نص المصدر", 1);

    const basePrompt: string = runAiTaskMock.mock.calls[0][0].basePrompt;
    expect(basePrompt).toMatch(/do not introduce islamic rulings/i);
    expect(basePrompt).toMatch(/return arabic only/i);
    expect(basePrompt).toMatch(/exactly one correct choice/i);
  });

  it("returns the parsed questions on a well-formed response", async () => {
    runAiTaskMock.mockResolvedValueOnce(ONE_GENERATED_QUESTION);

    const result = await generateQuestions("نص المصدر", 1);

    expect(result).toEqual([
      {
        text: "سؤال؟",
        explanation: "شرح",
        choices: [
          { text: "خطأ", isCorrect: false },
          { text: "صحيح", isCorrect: true },
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

  it("propagates an AiTaskError from the shared executor", async () => {
    runAiTaskMock.mockRejectedValueOnce(
      new AiTaskError("The AI request failed."),
    );

    await expect(generateQuestions("نص المصدر", 1)).rejects.toBeInstanceOf(
      AiTaskError,
    );
  });
});
