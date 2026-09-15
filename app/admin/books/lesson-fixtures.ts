import type { Lesson } from "@/lib/lessons/types";

/**
 * Fixture Lessons for Storybook stories and tests only (ANA-115).
 * Production routes load real Lessons from
 * `/api/v1/books/{bookId}/modules/{moduleId}/lessons` (see
 * `[id]/edit/page.tsx`) -- nothing here is read from or written to
 * Firebase/an API/local storage.
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
    ...overrides,
  };
}
