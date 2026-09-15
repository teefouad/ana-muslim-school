import type { Lesson } from "@/lib/lessons/types";

/**
 * Fixture Lessons for Storybook stories and tests only (ANA-111). Production
 * routes load real Lessons from
 * `/api/v1/books/{bookId}/modules/{moduleId}/lessons` (see
 * `[id]/modules/[moduleId]/edit/page.tsx`) -- nothing here is read from or
 * written to Firebase/an API/local storage.
 */
export const LESSON_FIXTURES: Lesson[] = [
  {
    id: "lesson-1",
    title: { ar: "مقدمة", en: "Introduction" },
    description: { ar: "درس تمهيدي.", en: "An introductory lesson." },
    type: "text",
    position: 2,
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
  },
  {
    id: "lesson-2",
    title: { ar: "", en: "" },
    description: { ar: "", en: "" },
    type: "quiz",
    position: 2,
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
  },
];

export function buildLessonFixture(overrides: Partial<Lesson> = {}): Lesson {
  return { ...LESSON_FIXTURES[0], ...overrides };
}
