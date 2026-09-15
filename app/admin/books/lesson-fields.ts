import type { TranslatedValue } from "@/components/ui/translatable-value";
import {
  LESSON_TYPES,
  type Lesson,
  type LessonType,
  type LessonWritableFields,
} from "@/lib/lessons/types";
import { toTranslatableString } from "./module-fields";

/**
 * The Lesson editor's controlled field values (ANA-114/ANA-115) --
 * deliberately limited to Type/Title/One-line description/Published/
 * Position, the only fields this editor exposes. Configuration and the
 * Questions section are a later task (ANA-110).
 */
export interface LessonFieldsValues {
  title: TranslatedValue;
  description: TranslatedValue;
  type: LessonType;
  position: number;
  isPublished: boolean;
}

/** Seeds the Lesson editor's fields from a real, API-backed Lesson (ANA-115). */
export function toLessonFieldsValues(lesson: Lesson): LessonFieldsValues {
  return {
    title: lesson.title,
    description: lesson.description,
    type: lesson.type,
    position: lesson.position,
    isPublished: lesson.isPublished,
  };
}

/**
 * Blank field values for New Lesson (ANA-115 PR review): opens the Lesson
 * editor with no Lesson id and no Firestore write -- this seeds its local
 * draft only, the same way `createEmptyModuleFieldsValues` seeds a
 * brand-new Module's draft before Save Module has ever been clicked. No
 * network request happens until the editor's own Save actually runs.
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

/**
 * Builds a `PATCH /books/{bookId}/modules/{moduleId}/lessons/{lessonId}`
 * body (ANA-115) from the Lesson editor's fields -- deliberately omits
 * Configuration/Questions-only fields (`reward`, `duration`, `videoURL`,
 * `azkar`, `questions`, `isLocked`), none of which this editor has UI for;
 * that endpoint leaves an omitted field unchanged, so a save here can never
 * clobber them (see ANA-110 for the eventual full editor).
 */
export function toLessonPatchFields(
  fields: LessonFieldsValues,
): Partial<LessonWritableFields> {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    type: fields.type,
    position: fields.position,
    isPublished: fields.isPublished,
  };
}

/**
 * Builds a `POST /books/{bookId}/modules/{moduleId}/lessons` body (ANA-115
 * PR review) from the Lesson editor's fields, once Save is actually clicked
 * on a no-id (New Lesson) draft -- the create endpoint requires every
 * writable field even though this editor only exposes a subset;
 * Configuration/Questions-only fields (`reward`, `duration`, `videoURL`,
 * `azkar`, `questions`, `isLocked`) get the same canonical empty defaults
 * ANA-110's eventual full editor would otherwise seed a new Lesson with.
 */
export function toLessonCreateFields(
  fields: LessonFieldsValues,
): LessonWritableFields {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    type: fields.type,
    position: fields.position,
    reward: { coins: 0 },
    duration: 0,
    videoURL: "",
    azkar: [],
    questions: [],
    isLocked: false,
    isPublished: fields.isPublished,
  };
}
