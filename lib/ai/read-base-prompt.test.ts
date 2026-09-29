import { describe, expect, it } from "vitest";

import { MAX_BASE_PROMPT_LENGTH, readBasePrompt } from "./read-base-prompt";

describe("readBasePrompt", () => {
  it("treats an omitted value as 'use the default prompt'", () => {
    expect(readBasePrompt(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts a non-blank string as-is, without trimming it", () => {
    expect(readBasePrompt("  Edited prompt\n")).toEqual({
      ok: true,
      value: "  Edited prompt\n",
    });
  });

  it.each([null, 42, {}, "", "   \n"])("rejects %j", (value) => {
    expect(readBasePrompt(value)).toEqual({
      ok: false,
      message: expect.stringContaining("basePrompt"),
    });
  });

  it("rejects a prompt over the length limit", () => {
    expect(readBasePrompt("a".repeat(MAX_BASE_PROMPT_LENGTH + 1)).ok).toBe(
      false,
    );
    expect(readBasePrompt("a".repeat(MAX_BASE_PROMPT_LENGTH)).ok).toBe(true);
  });
});
