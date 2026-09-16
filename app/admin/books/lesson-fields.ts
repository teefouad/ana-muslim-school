import {
  isSameTranslatedValue,
  type TranslatedValue,
} from "@/components/ui/translatable-value";
import {
  LESSON_TYPES,
  type Lesson,
  type LessonType,
  type LessonWritableFields,
} from "@/lib/lessons/types";
import { toTranslatableString } from "./module-fields";

/** One Break entry as edited in the Lesson form (ANA-118) -- `id` is a
 * client-only, locally-generated key (never persisted) that keeps each
 * entry's identity stable across reorders/edits within one editing session,
 * the same way `TempModule`'s own `id` does for Create-from-PDF's draft
 * Modules (import-source/import-source-types.ts). Stripped back out to the
 * plain `{ text, repeat }` shape the backend's `azkar` field expects by
 * `toLessonCreateFields`/`toLessonPatchFields` below. */
export interface LessonAzkarFieldEntry {
  id: string;
  text: TranslatedValue;
  repeat: number;
}

/**
 * The Lesson editor's controlled field values (ANA-114/ANA-115, expanded
 * with type-specific configuration in ANA-118). `content`/`videoURL`/
 * `duration`/`azkar` are all kept in state regardless of the currently
 * selected `type` -- only which of them the form *renders* depends on
 * `type` (see lesson-form.tsx) -- so switching types back and forth during
 * one editing session never drops whatever was already entered for another
 * type (ANA-118). Quiz/Final/Skip configuration (`reward`/`questions`/
 * `isLocked`) remains out of scope for this editor -- see
 * `hiddenLessonFieldDefaults` below.
 */
export interface LessonFieldsValues {
  title: TranslatedValue;
  description: TranslatedValue;
  type: LessonType;
  position: number;
  isPublished: boolean;
  content: TranslatedValue;
  videoURL: string;
  duration: number;
  azkar: LessonAzkarFieldEntry[];
}

/** Seeds the Lesson editor's fields from a real, API-backed Lesson
 * (ANA-116, expanded in ANA-118). Each `azkar` entry is given a fresh
 * client-only `id` (see `LessonAzkarFieldEntry`) -- the persisted shape has
 * none, since the displayed order alone is what's preserved on save. */
export function toLessonFieldsValues(lesson: Lesson): LessonFieldsValues {
  return {
    title: lesson.title,
    description: lesson.description,
    type: lesson.type,
    position: lesson.position,
    isPublished: lesson.isPublished,
    content: lesson.content,
    videoURL: lesson.videoURL,
    duration: lesson.duration,
    azkar: lesson.azkar.map((entry) => ({ id: crypto.randomUUID(), ...entry })),
  };
}

/**
 * Blank field values for New Lesson (ANA-115, expanded in ANA-118): opens
 * the Lesson editor with no Lesson id -- this seeds its local draft only,
 * the same way `createEmptyModuleFieldsValues` seeds a brand-new Module's
 * draft before Save Module has ever been clicked.
 */
export function createEmptyLessonFieldsValues(): LessonFieldsValues {
  return {
    title: {},
    description: {},
    type: LESSON_TYPES[0],
    position: 2,
    isPublished: false,
    content: {},
    videoURL: "",
    duration: 0,
    azkar: [],
  };
}

/** Temporary, schema-valid defaults for the Lesson fields this editor
 * still doesn't expose (ANA-116, narrowed in ANA-118 now that `content`/
 * `videoURL`/`duration`/`azkar` have real UI) -- Quiz/Final/Skip
 * configuration is a later task; these placeholder values only let create
 * round-trip through the real, already-stricter backend schema. A function
 * (not a shared constant) so every call gets its own fresh, mutable
 * `questions` array. */
function hiddenLessonFieldDefaults(): Pick<
  LessonWritableFields,
  "reward" | "questions" | "isLocked"
> {
  return {
    reward: { coins: 0 },
    questions: [],
    isLocked: false,
  };
}

function toLessonAzkar(
  entries: LessonAzkarFieldEntry[],
): LessonWritableFields["azkar"] {
  return entries.map(({ text, repeat }) => ({
    text: toTranslatableString(text),
    repeat,
  }));
}

/** Builds a `POST /api/v1/books/{bookId}/modules/{moduleId}/lessons` body
 * (ANA-116, expanded in ANA-118) from the editor's fields -- every writable
 * field is required by that endpoint, so the fields this editor still
 * doesn't expose are filled with `hiddenLessonFieldDefaults()`. */
export function toLessonCreateFields(
  fields: LessonFieldsValues,
): LessonWritableFields {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    type: fields.type,
    position: fields.position,
    isPublished: fields.isPublished,
    content: toTranslatableString(fields.content),
    videoURL: fields.videoURL,
    duration: fields.duration,
    azkar: toLessonAzkar(fields.azkar),
    ...hiddenLessonFieldDefaults(),
  };
}

/** Builds a `PATCH .../lessons/{lessonId}` body (ANA-116, expanded in
 * ANA-118) from the editor's fields -- deliberately excludes `reward`/
 * `questions`/`isLocked`, the fields this editor still doesn't expose; that
 * endpoint leaves every omitted field unchanged, so an existing Lesson's
 * still-hidden fields are never reset by a Lesson editor save. */
export function toLessonPatchFields(
  fields: LessonFieldsValues,
): Partial<LessonWritableFields> {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    type: fields.type,
    position: fields.position,
    isPublished: fields.isPublished,
    content: toTranslatableString(fields.content),
    videoURL: fields.videoURL,
    duration: fields.duration,
    azkar: toLessonAzkar(fields.azkar),
  };
}

/** Compares two Break entry lists by their persisted content (`text`/
 * `repeat`) and order only, ignoring each entry's own `id` -- lesson-
 * editor.tsx's own dirty check can't compare `id`s directly, since
 * `toLessonFieldsValues` mints a fresh one on every call (including the
 * one lesson-editor.tsx re-derives on every render to pass as `useState`'s
 * initializer, which React only actually reads on mount). */
export function isSameAzkar(
  a: LessonAzkarFieldEntry[],
  b: LessonAzkarFieldEntry[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        isSameTranslatedValue(entry.text, b[index].text) &&
        entry.repeat === b[index].repeat,
    )
  );
}
