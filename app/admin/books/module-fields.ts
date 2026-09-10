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
}

export function createEmptyModuleFieldsValues(): ModuleFieldsValues {
  return {
    title: {},
    description: {},
    color: DEFAULT_APPLICATION_COLOR,
    content: {},
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
  };
}

function toTranslatableString(value: TranslatedValue): TranslatableString {
  return { ar: value.ar ?? "", en: value.en ?? "" };
}

/** Builds a `POST /api/v1/books/{bookId}/modules` body (ANA-94) from the
 * modal's fields. `content` is deliberately excluded -- it isn't a Module
 * field at all (see `ModuleFieldsValues` above); the caller persists it
 * separately as this Module's Learning Material via `createMaterial`, once
 * the Module itself exists and its real id is known. `isLocked`/
 * `isPublished` are required by that endpoint but this modal has no UI for
 * either, so they always default to `false` for a newly-created Module,
 * matching the Book form's own `DEFAULT_COLOR`-style default-on-create
 * convention. */
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
 * clobber a value set some other way. `content` is excluded here too, for
 * the same reason as `toModuleCreateFields` -- the caller persists it
 * separately via `createMaterial`/`updateMaterial`. */
export function toModulePatchFields(
  fields: ModuleFieldsValues,
): Partial<ModuleWritableFields> {
  return {
    title: toTranslatableString(fields.title),
    description: toTranslatableString(fields.description),
    color: fields.color,
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
