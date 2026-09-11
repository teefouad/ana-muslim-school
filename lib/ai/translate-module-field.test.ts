import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAiTaskMock } = vi.hoisted(() => ({ runAiTaskMock: vi.fn() }));

vi.mock("./run-ai-task", () => ({ runAiTask: runAiTaskMock }));

const { translateModuleField } = await import("./translate-module-field");

const EMPTY = { ar: "", en: "" };
const BOOK = { title: EMPTY, description: EMPTY, longDescription: EMPTY };

beforeEach(() => {
  vi.resetAllMocks();
  runAiTaskMock.mockResolvedValue("Translated text");
});

describe("translateModuleField", () => {
  it("delegates through the same generic executor", async () => {
    const result = await translateModuleField("النص العربي", "title", BOOK);

    expect(result).toBe("Translated text");
    expect(runAiTaskMock).toHaveBeenCalledTimes(1);
  });

  it("includes the source text under a label naming the target field", async () => {
    await translateModuleField("Module Title Arabic", "title", BOOK);

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/Module Title to translate/);
    expect(input).toMatch(/Module Title Arabic/);
  });

  it("labels a description translation distinctly from a title translation", async () => {
    await translateModuleField(
      "Module Description Arabic",
      "description",
      BOOK,
    );

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/Module Description to translate/);
  });

  it("labels a content translation as the Learning Material", async () => {
    await translateModuleField("Module content Arabic", "content", BOOK);

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/Module Learning Material to translate/);
  });

  it("includes only the Book's Arabic title/description/longDescription as orientation (ANA-99)", async () => {
    await translateModuleField("text", "title", {
      title: { ar: "عنوان الكتاب", en: "Book Title" },
      description: { ar: "وصف الكتاب", en: "Book Description" },
      longDescription: EMPTY,
    });

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/Book context/);
    expect(input).toMatch(/عنوان الكتاب/);
    expect(input).not.toMatch(/Book Title/);
  });

  it("includes sibling Module Arabic fields as Module context when translating the title (ANA-99)", async () => {
    await translateModuleField("text", "title", BOOK, {
      description: "وصف الوحدة",
      content: "محتوى الوحدة",
    });

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/Module context/);
    expect(input).toMatch(/وصف الوحدة/);
    expect(input).toMatch(/محتوى الوحدة/);
  });

  it("omits the Module's own current content from context when translating the content field itself, to avoid duplicating the text being translated", async () => {
    await translateModuleField("text to translate", "content", BOOK, {
      title: "عنوان الوحدة",
      content: "Existing content that should not appear twice",
    });

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).toMatch(/عنوان الوحدة/);
    expect(
      input.match(/Existing content that should not appear twice/g)?.length ??
        0,
    ).toBe(0);
  });

  it("omits the Module context section entirely when no sibling fields are supplied", async () => {
    await translateModuleField("text", "title", BOOK);

    const input: string = runAiTaskMock.mock.calls[0][0].input;
    expect(input).not.toMatch(/Module context/);
  });

  it("passes additional instructions through separately", async () => {
    await translateModuleField(
      "text",
      "title",
      BOOK,
      undefined,
      "Keep it short",
    );

    expect(runAiTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ additionalInstructions: "Keep it short" }),
    );
  });

  it("uses a fixed base prompt that requires using context for meaning, not translating the context itself", async () => {
    await translateModuleField("text", "title", BOOK);

    const basePrompt: string = runAiTaskMock.mock.calls[0][0].basePrompt;
    expect(basePrompt).toMatch(/never additional text to\s+translate/i);
    expect(basePrompt).toMatch(/isolated string/i);
    expect(basePrompt).toMatch(/no preamble/i);
  });

  it("never describes Additional Instructions as lower priority than the base prompt (ANA-99 hard requirement)", async () => {
    await translateModuleField("text", "title", BOOK);

    const basePrompt: string = runAiTaskMock.mock.calls[0][0].basePrompt;
    expect(basePrompt).not.toMatch(/lower.priority/i);
    expect(basePrompt).toMatch(/equally important/i);
  });
});
