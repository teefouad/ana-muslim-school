/** One value per language slug, e.g. `{ ar: "...", en: "Title" }`. */
export type TranslatedValue = Record<string, string>;

export interface LanguageOption {
  /** Stable identifier for the language, e.g. an ISO slug ("en", "ar"). */
  slug: string;
  label: string;
}

/** Compares two `TranslatedValue`s by their `ar`/`en` slots specifically
 * (a missing slot treated as `""`), the shape every editor built on
 * `FormField`'s default languages actually uses -- shared by every
 * unsaved-changes ("is this draft dirty?") check across those editors
 * (lesson-editor.tsx, module-editor-body.tsx) so they don't each redefine
 * the same comparison. */
export function isSameTranslatedValue(a: TranslatedValue, b: TranslatedValue) {
  return (a.ar ?? "") === (b.ar ?? "") && (a.en ?? "") === (b.en ?? "");
}
