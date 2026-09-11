import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("./ai-client", () => ({
  AI_MODEL: "gpt-5.6-terra-test",
  getOpenAiClient: () => ({ responses: { create: createMock } }),
}));

const { runAiTask, AiTaskError } = await import("./run-ai-task");
const { AI_MODEL } = await import("./ai-client");

function mockResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: "completed",
    output_text: "Result text",
    error: null,
    incomplete_details: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("runAiTask", () => {
  it("sends the trusted base prompt separately from the input", async () => {
    createMock.mockResolvedValue(mockResponse());

    await runAiTask({ input: "source text", basePrompt: "base instructions" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: "base instructions",
        input: "source text",
      }),
    );
  });

  it("composes non-empty additional instructions into the instructions channel, at the same priority as the base prompt, never into the input (ANA-99)", async () => {
    createMock.mockResolvedValue(mockResponse());

    await runAiTask({
      input: "source text",
      basePrompt: "base instructions",
      additionalInstructions: "make it shorter",
    });

    const call = createMock.mock.calls[0][0];
    expect(call.input).toBe("source text");
    expect(call.instructions).toMatch(/^base instructions/);
    expect(call.instructions).toMatch(/make it shorter/);
    expect(call.instructions).not.toMatch(/lower.priority/i);
  });

  it("ignores whitespace-only additional instructions", async () => {
    createMock.mockResolvedValue(mockResponse());

    await runAiTask({
      input: "source text",
      basePrompt: "base instructions",
      additionalInstructions: "   \n\t  ",
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "source text",
        instructions: "base instructions",
      }),
    );
  });

  it("uses the centralized model", async () => {
    createMock.mockResolvedValue(mockResponse());

    await runAiTask({ input: "source text", basePrompt: "base instructions" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: AI_MODEL }),
    );
  });

  it("passes maxOutputTokens through when provided", async () => {
    createMock.mockResolvedValue(mockResponse());

    await runAiTask({
      input: "source text",
      basePrompt: "base instructions",
      maxOutputTokens: 500,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ max_output_tokens: 500 }),
    );
  });

  it("returns trimmed successful text", async () => {
    createMock.mockResolvedValue(
      mockResponse({ output_text: "  Hello world  \n" }),
    );

    const result = await runAiTask({
      input: "source text",
      basePrompt: "base instructions",
    });

    expect(result).toBe("Hello world");
  });

  it("rejects empty output", async () => {
    createMock.mockResolvedValue(mockResponse({ output_text: "   " }));

    await expect(
      runAiTask({ input: "source text", basePrompt: "base instructions" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("rejects incomplete/truncated/non-successful responses", async () => {
    createMock.mockResolvedValue(
      mockResponse({
        status: "incomplete",
        output_text: "partial text",
        incomplete_details: { reason: "max_output_tokens" },
      }),
    );

    await expect(
      runAiTask({ input: "source text", basePrompt: "base instructions" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("surfaces provider errors without exposing secrets", async () => {
    const secret = "sk-super-secret-key-should-never-appear";
    createMock.mockRejectedValue(new Error(`auth failed for ${secret}`));

    const rejection = runAiTask({
      input: "source text",
      basePrompt: "base instructions",
    });

    await expect(rejection).rejects.toBeInstanceOf(AiTaskError);
    await expect(rejection).rejects.not.toMatchObject({
      message: expect.stringContaining(secret),
    });
  });
});
