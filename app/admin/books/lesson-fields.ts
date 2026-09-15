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
 * Questions section are a later task (ANA-110). Real Lesson persistence
 * (ANA-116) fills every other `LessonWritableFields` key with a temporary,
 * schema-valid default -- see `toLessonCreateFields` -- rather than exposing
 * them here.
 */
export interface LessonFieldsValues {
  title: TranslatedValue;
  description: TranslatedValue;
  type: LessonType;
  position: number;
  isPublished: boolean;
}

/** Seeds the Lesson editor's fields from a real, API-backed Lesson
 * (ANA-116). */
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

/** Temporary, schema-valid defaults for the Lesson fields this editor
 * doesn't expose yet (ANA-116) -- Configuration/Questions UI is out of
 * scope for this task; these placeholder values only let create/update
 * round-trip through the real, already-stricter backend schema. Proper
 * population is a later task (ANA-110). A function (not a shared constant)
 * so every call gets its own fresh, mutable `azkar`/`questions` arrays. */
function hiddenLessonFieldDefaults(): Pick<
  LessonWritableFields,
  "reward" | "duration" | "videoURL" | "azkar" | "questions" | "isLocked"
> {
  return {
    reward: { coins: 0 },
    duration: 0,
    videoURL: "",
    azkar: [],
    questions: [],
    isLocked: false,
  };
}

/** Builds a `POST /api/v1/books/{bookId}/modules/{moduleId}/lessons` body
 * (ANA-116) from the editor's fields -- every writable field is required by
 * that endpoint, so the fields this editor doesn't expose are filled with
 * `hiddenLessonFieldDefaults()`. */
export function toLessonCreateFields(
  fields: LessonFieldsValues,
): LessonWritableFields {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    type: fields.type,
    position: fields.position,
    isPublished: fields.isPublished,
    ...hiddenLessonFieldDefaults(),
  };
}

/** Builds a `PATCH .../lessons/{lessonId}` body (ANA-116) from the editor's
 * fields -- deliberately includes only the five fields this editor owns;
 * that endpoint leaves every omitted field (`reward`/`duration`/
 * `videoURL`/`azkar`/`questions`/`isLocked`) unchanged, so an existing
 * Lesson's hidden fields are never reset by a Lesson editor save. */
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
