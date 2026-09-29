import { describe, expect, it } from "vitest";

import type { Question } from "@/lib/questions/types";
import {
  applyParsedQuestionText,
  fromGeneratedQuestion,
  hasInvalidQuestionText,
  isSameQuestionEntries,
  makeQuestionFieldEntry,
  toQuestionFieldEntry,
  toQuestionWritableFields,
  type QuestionFieldEntry,
} from "./question-fields";
import { parseQuestionText } from "./question-text-format";

function buildQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "question-1",
    text: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
    explanation: { ar: "شرح", en: "Explanation" },
    choices: [
      { text: { ar: "أ", en: "A" }, isCorrect: false },
      { text: { ar: "ب", en: "B" }, isCorrect: true },
    ],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: "a@example.com",
    updatedBy: "a@example.com",
    ...overrides,
  };
}

describe("makeQuestionFieldEntry", () => {
  it("creates a blank draft with no linked id", () => {
    const entry = makeQuestionFieldEntry();

    expect(entry.id).toBeNull();
    expect(entry.text).toEqual({});
    expect(entry.explanation).toEqual({});
    expect(entry.choices).toEqual([]);
    expect(entry.rawText).toEqual({});
    expect(entry.key).toEqual(expect.any(String));
  });
});

describe("toQuestionFieldEntry", () => {
  it("seeds the linked id and serializes rawText for both languages", () => {
    const entry = toQuestionFieldEntry(buildQuestion());

    expect(entry.id).toBe("question-1");
    expect(entry.text).toEqual({ ar: "ما هي الصلاة؟", en: "What is Salah?" });
    expect(entry.rawText.ar).toBe(
      ["ما هي الصلاة؟", "", "شرح", "", "[ ] أ", "[x] ب"].join("\n"),
    );
    expect(entry.rawText.en).toBe(
      ["What is Salah?", "", "Explanation", "", "[ ] A", "[x] B"].join("\n"),
    );
  });
});

describe("fromGeneratedQuestion (ANA-131)", () => {
  it("seeds an Arabic-only draft with no linked id, leaving English blank for Translate", () => {
    const entry = fromGeneratedQuestion({
      text: "سؤال؟",
      explanation: "شرح",
      choices: [
        { text: "أ", isCorrect: false },
        { text: "ب", isCorrect: true },
      ],
    });

    expect(entry.id).toBeNull();
    expect(entry.text).toEqual({ ar: "سؤال؟" });
    expect(entry.explanation).toEqual({ ar: "شرح" });
    expect(entry.choices).toEqual([
      { text: { ar: "أ" }, isCorrect: false },
      { text: { ar: "ب" }, isCorrect: true },
    ]);
    expect(entry.rawText.ar).toBe(
      ["سؤال؟", "", "شرح", "", "[ ] أ", "[x] ب"].join("\n"),
    );
    expect(entry.text.en).toBeUndefined();
    expect(entry.explanation.en).toBeUndefined();
    expect(entry.choices.every((choice) => choice.text.en === undefined)).toBe(
      true,
    );
    expect(entry.key).toEqual(expect.any(String));
  });
});

describe("applyParsedQuestionText", () => {
  it("updates only the edited language's text/explanation, preserving the other", () => {
    const entry = toQuestionFieldEntry(buildQuestion());
    const parsed = parseQuestionText("Updated?\n\n[x] A\n[ ] B");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const updated = applyParsedQuestionText(entry, "en", parsed.value);

    expect(updated.text).toEqual({ ar: "ما هي الصلاة؟", en: "Updated?" });
    expect(updated.choices[0].text).toEqual({ ar: "أ", en: "A" });
    expect(updated.choices[1].text).toEqual({ ar: "ب", en: "B" });
  });

  it("makes the just-parsed language's correctness authoritative for every choice", () => {
    const entry = toQuestionFieldEntry(buildQuestion());
    // English now marks the *first* choice correct instead of the second.
    const parsed = parseQuestionText("Updated?\n\n[x] A\n[ ] B");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const updated = applyParsedQuestionText(entry, "en", parsed.value);

    expect(updated.choices.map((choice) => choice.isCorrect)).toEqual([
      true,
      false,
    ]);
  });

  it("starts a newly-added choice position blank in the other language", () => {
    const entry = toQuestionFieldEntry(buildQuestion());
    const parsed = parseQuestionText("Updated?\n\n[x] A\n[ ] B\n[ ] C");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const updated = applyParsedQuestionText(entry, "en", parsed.value);

    expect(updated.choices[2].text).toEqual({ ar: undefined, en: "C" });
  });
});

describe("toQuestionWritableFields", () => {
  it("strips key/id/rawText and normalizes translated values", () => {
    const entry = toQuestionFieldEntry(buildQuestion());

    expect(toQuestionWritableFields(entry)).toEqual({
      text: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
      explanation: { ar: "شرح", en: "Explanation" },
      choices: [
        { text: { ar: "أ", en: "A" }, isCorrect: false },
        { text: { ar: "ب", en: "B" }, isCorrect: true },
      ],
    });
  });
});

describe("isSameQuestionEntries", () => {
  const base: QuestionFieldEntry[] = [toQuestionFieldEntry(buildQuestion())];

  it("is true for the same list", () => {
    expect(isSameQuestionEntries(base, base)).toBe(true);
  });

  it("is false when the order or count differs", () => {
    expect(isSameQuestionEntries(base, [])).toBe(false);
  });

  it("is false when an entry's raw text changed, ignoring key", () => {
    const edited: QuestionFieldEntry[] = [
      {
        ...base[0],
        key: "different-key",
        rawText: { ...base[0].rawText, ar: "changed" },
      },
    ];

    expect(isSameQuestionEntries(base, edited)).toBe(false);
  });

  it("is false when an entry's linked id differs", () => {
    const edited: QuestionFieldEntry[] = [{ ...base[0], id: "other-id" }];

    expect(isSameQuestionEntries(base, edited)).toBe(false);
  });
});

describe("hasInvalidQuestionText", () => {
  it("is false when every entry's rawText parses in both languages", () => {
    const entries: QuestionFieldEntry[] = [
      toQuestionFieldEntry(buildQuestion()),
    ];

    expect(hasInvalidQuestionText(entries)).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(hasInvalidQuestionText([])).toBe(false);
  });

  it("is true when an entry's Arabic rawText is malformed", () => {
    const entry = makeQuestionFieldEntry();
    entry.rawText = { ar: "Q?\n\n[x]a", en: "" };

    expect(hasInvalidQuestionText([entry])).toBe(true);
  });

  it("is true when an entry's English rawText is malformed, even if Arabic is valid", () => {
    const entry = makeQuestionFieldEntry();
    entry.rawText = { ar: "سؤال", en: "Q?\n\n[X] a" };

    expect(hasInvalidQuestionText([entry])).toBe(true);
  });

  it("is true when any entry in a list is invalid, not just the first", () => {
    const valid = toQuestionFieldEntry(buildQuestion());
    const invalid = makeQuestionFieldEntry();
    invalid.rawText = { ar: "Q?\n\n[ ]  a", en: "" };

    expect(hasInvalidQuestionText([valid, invalid])).toBe(true);
  });
});
