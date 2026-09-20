/**
 * A bilingual string used across the learning-content domain (Book/Module/
 * Lesson/Question titles, descriptions, etc. -- see ANA-62). Both keys must
 * always exist; empty strings are allowed so draft content can be
 * incomplete.
 */
export type TranslatableString = {
  ar: string;
  en: string;
};

/** Picks the value to display for a bilingual field (ANA-128) -- Arabic
 * first, English otherwise, or `""` when both are blank. Shared by every
 * admin list/label that shows one of these fields as plain text; each
 * caller composes its own further fallback (a fixed "Untitled ..." string,
 * a positional placeholder, or none at all) on top of this one shared
 * language-preference step. */
export function preferredTranslatableStringValue(
  value: TranslatableString,
): string {
  return value.ar || value.en;
}

/** Validates Firestore-sourced data before it's trusted as a `TranslatableString`. */
export function isValidTranslatableString(
  value: unknown,
): value is TranslatableString {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return typeof v.ar === "string" && typeof v.en === "string";
}

/**
 * Parses an `unknown` request-body value into a `TranslatableString`,
 * rejecting anything that isn't exactly `{ ar: string; en: string }`
 * (extra keys included, so a caller can't smuggle unrelated fields through
 * a nested object).
 */
export function parseTranslatableString(
  value: unknown,
): TranslatableString | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (typeof v.ar !== "string" || typeof v.en !== "string") {
    return null;
  }

  if (Object.keys(v).length !== 2) {
    return null;
  }

  return { ar: v.ar, en: v.en };
}
