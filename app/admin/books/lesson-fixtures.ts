import type { MockLesson } from "./mock-lessons";

/**
 * Fixture Lessons for Storybook stories and tests only (ANA-115) --
 * frontend-only local data (ANA-111/ANA-114); real Lesson persistence is
 * deferred to ANA-116.
 */
export function buildLessonFixture(
  overrides: Partial<MockLesson> = {},
): MockLesson {
  return {
    id: "lesson-1",
    title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
    description: {},
    type: "text",
    position: 0,
    isPublished: false,
    ...overrides,
  };
}
