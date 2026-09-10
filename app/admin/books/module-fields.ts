import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type { Module, ModuleWritableFields } from "@/lib/modules/types";

/**
 * The Edit Module modal's controlled field values (ANA-91). Frontend-only,
 * local-only state -- `content` has no equivalent on the real, Firestore-
 * backed `Module` (`lib/modules/types.ts`, which only has `lessons: string[]`
 * today), so nothing here is ever sent to an API; Save changes only updates
 * this page's own local draft (see `[id]/edit/page.tsx`).
 */
export interface ModuleFieldsValues {
  title: TranslatedValue;
  description: TranslatedValue;
  color: string;
  content: TranslatedValue;
}

export function createEmptyModuleFieldsValues(): ModuleFieldsValues {
  return {
    title: {},
    description: {},
    color: DEFAULT_APPLICATION_COLOR,
    content: {},
  };
}

/** Seeds the modal's fields from a real, API-backed Module -- `content` has
 * no persisted equivalent yet (see above), so it always starts blank. */
export function toModuleFieldsValues(module: Module): ModuleFieldsValues {
  return {
    title: module.title,
    description: module.description,
    color: module.color,
    content: {},
  };
}

function toTranslatableString(value: TranslatedValue): TranslatableString {
  return { ar: value.ar ?? "", en: value.en ?? "" };
}

/** Builds a `POST /api/v1/books/{bookId}/modules` body (ANA-94) from the
 * modal's fields -- `content` is never sent, it has no persisted field yet
 * (see above). `isLocked`/`isPublished` are required by that endpoint but
 * this modal has no UI for either, so they always default to `false` for a
 * newly-created Module, matching the Book form's own `DEFAULT_COLOR`-style
 * default-on-create convention. */
export function toModuleCreateFields(
  fields: ModuleFieldsValues,
): ModuleWritableFields {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    color: fields.color,
    isLocked: false,
    isPublished: false,
  };
}

/** Builds a `PATCH /api/v1/books/{bookId}/modules/{moduleId}` body (ANA-94)
 * from the modal's fields -- deliberately omits `isLocked`/`isPublished`
 * (that endpoint leaves an omitted field unchanged) since this modal has no
 * UI for either; sending `false` unconditionally here would silently
 * clobber a value set some other way. `content` is never sent (see
 * `toModuleFieldsValues` above). */
export function toModulePatchFields(
  fields: ModuleFieldsValues,
): Partial<ModuleWritableFields> {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    color: fields.color,
  };
}
