import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type { Module, ModuleWritableFields } from "@/lib/modules/types";

/**
 * The Edit Module modal's controlled field values (ANA-91). `content` is
 * this Module's Learning Material (ANA-94 PR review) -- the same content
 * Module Builder edits/persists via the Material APIs
 * (`import-source/materials-client.ts`), not a field on `Module` itself
 * (`lib/modules/types.ts` has no such field; a Module <-> Material relation
 * is by `moduleId`, see `lib/materials/types.ts`).
 */
export interface ModuleFieldsValues {
  title: TranslatedValue;
  description: TranslatedValue;
  color: string;
  content: TranslatedValue;
  /** The modal's Published toggle (ANA-117) -- `isLocked` still has no UI
   * here, so it's left out of this shape entirely, unlike `isPublished`. */
  isPublished: boolean;
}

export function createEmptyModuleFieldsValues(): ModuleFieldsValues {
  return {
    title: {},
    description: {},
    color: DEFAULT_APPLICATION_COLOR,
    content: {},
    isPublished: false,
  };
}

/** Seeds the modal's fields from a real, API-backed Module -- `content`
 * comes from that Module's existing Learning Material (ANA-94 PR review),
 * `{}` when it has none yet (a Module created before this Book had any, or
 * one that's never had its Content field touched). */
export function toModuleFieldsValues(
  module: Module,
  content: TranslatedValue = {},
): ModuleFieldsValues {
  return {
    title: module.title,
    description: module.description,
    color: module.color,
    content,
    isPublished: module.isPublished,
  };
}

/** Normalizes a `FormField`-shaped `TranslatedValue` (whose `ar`/`en` keys
 * may be absent for an unfilled draft) into a full `TranslatableString`.
 * Also reused by `question-fields.ts` and `lesson-fields.ts` for the same
 * normalization on their own fields, not just when building this file's own
 * Module create/patch request bodies below. */
export function toTranslatableString(
  value: TranslatedValue,
): TranslatableString {
  return { ar: value.ar ?? "", en: value.en ?? "" };
}

/** Builds a `POST /api/v1/books/{bookId}/modules` body (ANA-94) from the
 * modal's fields. `content` is deliberately excluded -- it isn't a Module
 * field at all (see `ModuleFieldsValues` above); the caller persists it
 * separately as this Module's Learning Material via `createMaterial`, once
 * the Module itself exists and its real id is known. `isLocked` is required
 * by that endpoint but this modal still has no UI for it, so it always
 * defaults to `false` for a newly-created Module, matching the Book form's
 * own `DEFAULT_COLOR`-style default-on-create convention. `isPublished`
 * (ANA-117) does have UI here now, so it's sent as entered rather than
 * defaulted. */
export function toModuleCreateFields(
  fields: ModuleFieldsValues,
): ModuleWritableFields {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    color: fields.color,
    isLocked: false,
    isPublished: fields.isPublished,
  };
}

/** Builds a `PATCH /api/v1/books/{bookId}/modules/{moduleId}` body (ANA-94,
 * `isPublished` added in ANA-117) from the modal's fields -- deliberately
 * omits `isLocked` (that endpoint leaves an omitted field unchanged) since
 * this modal still has no UI for it; sending `false` unconditionally here
 * would silently clobber a value set some other way. `content` is excluded
 * here too, for the same reason as `toModuleCreateFields` -- the caller
 * persists it separately via `createMaterial`/`updateMaterial`. `lessons`
 * (a reordered Lesson id list, ANA-117) is deliberately not built here --
 * it isn't one of this modal's own fields, so the caller
 * (`[id]/edit/page.tsx`'s `handleSaveModule`) merges it into the PATCH body
 * itself only when a reorder is actually pending. */
export function toModulePatchFields(
  fields: ModuleFieldsValues,
): Partial<ModuleWritableFields> {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    color: fields.color,
    isPublished: fields.isPublished,
  };
}

/** The modal's `content` field, normalized to the `{ ar, en }` shape the
 * Material APIs require (ANA-94 PR review) -- passed to `createMaterial`/
 * `updateMaterial`, never to a Module create/patch body. */
export function toMaterialContent(
  fields: ModuleFieldsValues,
): TranslatableString {
  return toTranslatableString(fields.content);
}
