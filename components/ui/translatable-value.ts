/** One value per language slug, e.g. `{ ar: "...", en: "Title" }`. */
export type TranslatedValue = Record<string, string>;

export interface LanguageOption {
  /** Stable identifier for the language, e.g. an ISO slug ("en", "ar"). */
  slug: string;
  label: string;
}
