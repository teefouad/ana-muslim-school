import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { Module } from "@/lib/modules/types";

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
