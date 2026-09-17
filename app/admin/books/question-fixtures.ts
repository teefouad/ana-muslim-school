import type { Question } from "@/lib/questions/types";

/** Fixture Questions for Storybook stories and tests only (ANA-119) -- a
 * real, API-backed Question document, matching `buildLessonFixture`'s own
 * role for Lessons (lesson-fixtures.ts). */
export function buildQuestionFixture(
  overrides: Partial<Question> = {},
): Question {
  return {
    id: "question-1",
    text: { ar: "ما هي أركان الصلاة؟", en: "What are the pillars of Salah?" },
    explanation: { ar: "", en: "" },
    choices: [
      { text: { ar: "خمسة", en: "Five" }, isCorrect: false },
      { text: { ar: "سبعة", en: "Seven" }, isCorrect: true },
    ],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: "a@example.com",
    updatedBy: "a@example.com",
    ...overrides,
  };
}
