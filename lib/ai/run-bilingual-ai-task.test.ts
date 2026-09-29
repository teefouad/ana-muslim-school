import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAiTaskMock } = vi.hoisted(() => ({ runAiTaskMock: vi.fn() }));

vi.mock("./run-ai-task", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./run-ai-task")>()),
  runAiTask: runAiTaskMock,
}));

const { runBilingualAiTask, formatBilingualContext } =
  await import("./run-bilingual-ai-task");
const { AiTaskError } = await import("./run-ai-task");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("runBilingualAiTask", () => {
  it("forwards the input, prompt, and instructions, and requests an ar/en json_schema", async () => {
    runAiTaskMock.mockResolvedValueOnce(
      JSON.stringify({ ar: "مرحبا", en: "Hello" }),
    );

    await runBilingualAiTask({
      input: "source",
      basePrompt: "base",
      additionalInstructions: "at most 12 words",
    });

    expect(runAiTaskMock).toHaveBeenCalledWith({
      input: "source",
      basePrompt: "base",
      additionalInstructions: "at most 12 words",
      responseFormat: {
        name: "bilingual_text",
        schema: expect.objectContaining({ required: ["ar", "en"] }),
      },
    });
  });

  it("returns both languages, trimmed", async () => {
    runAiTaskMock.mockResolvedValueOnce(
      JSON.stringify({ ar: "  مرحبا ", en: " Hello  " }),
    );

    await expect(
      runBilingualAiTask({ input: "x", basePrompt: "y" }),
    ).resolves.toEqual({ ar: "مرحبا", en: "Hello" });
  });

  it.each([
    ["not json", "not json"],
    ["a missing language", JSON.stringify({ ar: "مرحبا" })],
    ["a blank language", JSON.stringify({ ar: "مرحبا", en: "  " })],
    ["a non-string language", JSON.stringify({ ar: "مرحبا", en: 1 })],
    ["a non-object", JSON.stringify("text")],
  ])("throws an AiTaskError for %s", async (_label, raw) => {
    runAiTaskMock.mockResolvedValueOnce(raw);

    await expect(
      runBilingualAiTask({ input: "x", basePrompt: "y" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("propagates an AiTaskError from the shared executor", async () => {
    runAiTaskMock.mockRejectedValueOnce(new AiTaskError("failed"));

    await expect(
      runBilingualAiTask({ input: "x", basePrompt: "y" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });
});

describe("formatBilingualContext", () => {
  it("lists whichever languages have content, labelled", () => {
    expect(formatBilingualContext({ ar: "أ", en: "A" }, "none")).toBe(
      "Arabic: أ\nEnglish: A",
    );
    expect(formatBilingualContext({ ar: " ", en: "A" }, "none")).toBe(
      "English: A",
    );
  });

  it("returns the placeholder when both are blank", () => {
    expect(formatBilingualContext({ ar: "", en: " " }, "none")).toBe("none");
  });
});
