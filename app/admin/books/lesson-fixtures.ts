import type { Lesson } from "@/lib/lessons/types";

/**
 * Fixture Lessons for Storybook stories and tests only (ANA-115, wired to
 * the real `Lesson` shape in ANA-116) -- a real, API-backed Lesson document,
 * not a frontend-only mock. `reward`/`duration`/`videoURL`/`azkar`/
 * `questions`/`isLocked` are Configuration/Questions fields the Lesson
 * editor doesn't expose yet (ANA-110); their fixture defaults here are
 * unrelated to `lesson-fields.ts`'s own temporary create defaults, which
 * exist for a different reason (schema-valid placeholders sent on create).
 */
export function buildLessonFixture(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "lesson-1",
    title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
    description: { ar: "", en: "" },
    type: "text",
    position: 0,
    reward: { coins: 0 },
    duration: 0,
    videoURL: "",
    azkar: [],
    questions: [],
    isLocked: false,
    isPublished: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: "a@example.com",
    updatedBy: "a@example.com",
    ...overrides,
  };
}
