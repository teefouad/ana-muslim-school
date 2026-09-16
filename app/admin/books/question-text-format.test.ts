import { describe, expect, it } from "vitest";

import {
  parseQuestionText,
  serializeQuestionText,
} from "./question-text-format";

describe("parseQuestionText", () => {
  it("parses a blank/whitespace-only textarea as a valid blank question", () => {
    expect(parseQuestionText("")).toEqual({
      ok: true,
      value: { text: "", explanation: "", choices: [] },
    });
    expect(parseQuestionText("   \n  \n")).toEqual({
      ok: true,
      value: { text: "", explanation: "", choices: [] },
    });
  });

  it("maps question -> explanation -> choices in order", () => {
    const raw = [
      "What is ...?",
      "",
      "Explanation of the answer.",
      "",
      "[ ] First choice",
      "[x] Correct choice",
      "[ ] Third choice",
    ].join("\n");

    expect(parseQuestionText(raw)).toEqual({
      ok: true,
      value: {
        text: "What is ...?",
        explanation: "Explanation of the answer.",
        choices: [
          { text: "First choice", isCorrect: false },
          { text: "Correct choice", isCorrect: true },
          { text: "Third choice", isCorrect: false },
        ],
      },
    });
  });

  it("maps [x] to isCorrect: true and [ ] to isCorrect: false", () => {
    const raw = "Q?\n\n[x] a\n[ ] b";
    const result = parseQuestionText(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.choices).toEqual([
        { text: "a", isCorrect: true },
        { text: "b", isCorrect: false },
      ]);
    }
  });

  it("treats text with no explanation and no choices as just the question", () => {
    expect(parseQuestionText("Just a question?")).toEqual({
      ok: true,
      value: { text: "Just a question?", explanation: "", choices: [] },
    });
  });

  it("allows multi-line/multi-paragraph explanations before the first choice", () => {
    const raw = "Q?\n\nLine one.\n\nLine two.\n\n[x] a";
    const result = parseQuestionText(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.explanation).toBe("Line one.\n\nLine two.");
    }
  });

  it.each([
    ["missing the space after the marker", "Q?\n\n[x]a"],
    ["using an uppercase X", "Q?\n\n[X] a"],
    ["using two spaces after the marker", "Q?\n\n[ ]  a"],
  ])(
    "rejects a malformed choice marker (%s) as a parse error",
    (_label, raw) => {
      const result = parseQuestionText(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/\[ \]/);
      }
    },
  );

  it("rejects a non-choice line once choices have started", () => {
    const raw = "Q?\n\n[x] a\nnot a choice";
    const result = parseQuestionText(raw);
    expect(result.ok).toBe(false);
  });

  it("ignores blank lines interleaved between choices", () => {
    const raw = "Q?\n\n[x] a\n\n[ ] b";
    const result = parseQuestionText(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.choices).toEqual([
        { text: "a", isCorrect: true },
        { text: "b", isCorrect: false },
      ]);
    }
  });
});

describe("serializeQuestionText", () => {
  it("round-trips a full question through parse -> serialize -> parse", () => {
    const raw = [
      "What is ...?",
      "",
      "Explanation of the answer.",
      "",
      "[ ] First choice",
      "[x] Correct choice",
    ].join("\n");

    const parsed = parseQuestionText(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const serialized = serializeQuestionText(parsed.value);
    expect(serialized).toBe(raw);
    expect(parseQuestionText(serialized)).toEqual(parsed);
  });

  it("omits the explanation block entirely when empty", () => {
    expect(
      serializeQuestionText({ text: "Q?", explanation: "", choices: [] }),
    ).toBe("Q?");
  });

  it("omits the choices block entirely when empty", () => {
    expect(
      serializeQuestionText({
        text: "Q?",
        explanation: "Because.",
        choices: [],
      }),
    ).toBe("Q?\n\nBecause.");
  });
});
