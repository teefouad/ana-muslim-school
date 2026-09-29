import { describe, expect, it } from "vitest";

import { AI_PROMPT_TASKS } from "./base-prompt-tasks";
import { getBasePrompt } from "./base-prompts";
import { BASE_PROMPT as MODULE_TITLE } from "./suggest-module-title";

describe("getBasePrompt", () => {
  it("returns a non-empty prompt for every AI task", () => {
    for (const task of AI_PROMPT_TASKS) {
      expect(getBasePrompt(task).trim().length).toBeGreaterThan(0);
    }
  });

  it("returns exactly the prompt the helper falls back to", () => {
    expect(getBasePrompt("assist.title")).toBe(MODULE_TITLE);
  });

  it("follows the requested language for Book description prompts", () => {
    expect(getBasePrompt("assist.bookDescription", "en")).toMatch(/English/);
    expect(getBasePrompt("assist.bookDescription", "ar")).toMatch(/Arabic/);
    expect(getBasePrompt("assist.bookLongDescription", "en")).toMatch(
      /English/,
    );
  });
});
