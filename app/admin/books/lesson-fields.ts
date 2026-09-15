import type { TranslatedValue } from "@/components/ui/translatable-value";
import { LESSON_TYPES, type LessonType } from "@/lib/lessons/types";
import type { MockLesson } from "./mock-lessons";

/**
 * The Lesson editor's controlled field values (ANA-114/ANA-115) --
 * deliberately limited to Type/Title/One-line description/Published/
 * Position, the only fields this editor exposes. Configuration and the
 * Questions section are a later task (ANA-110). Frontend-only, matching
 * `MockLesson`'s own fields minus `id` -- Lesson persistence is deferred to
 * a follow-up task (ANA-116), so this never assumes or builds a backend
 * request body.
 */
export interface LessonFieldsValues {
  title: TranslatedValue;
  description: TranslatedValue;
  type: LessonType;
  position: number;
  isPublished: boolean;
}

/** Seeds the Lesson editor's fields from an existing, local `MockLesson`
 * (ANA-111/ANA-114). */
export function toLessonFieldsValues(lesson: MockLesson): LessonFieldsValues {
  return {
    title: lesson.title,
    description: lesson.description,
    type: lesson.type,
    position: lesson.position,
    isPublished: lesson.isPublished,
  };
}

/**
 * Blank field values for New Lesson (ANA-115): opens the Lesson editor
 * with no Lesson id -- this seeds its local draft only, the same way
 * `createEmptyModuleFieldsValues` seeds a brand-new Module's draft before
 * Save Module has ever been clicked.
 */
export function createEmptyLessonFieldsValues(): LessonFieldsValues {
  return {
    title: {},
    description: {},
    type: LESSON_TYPES[0],
    position: 2,
    isPublished: false,
  };
}
