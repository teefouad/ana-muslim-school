import {
  isValidTranslatableString,
  type TranslatableString,
} from "@/lib/learning-content/translatable-string";

export type Material = {
  id: string;
  bookId: string;
  moduleId: string;
  content: TranslatableString;
};

export type MaterialWritableFields = {
  bookId: string;
  moduleId: string;
  content: TranslatableString;
};

/** A Material document as it may actually be stored in Firestore: `content`
 * is either the current `TranslatableString` shape or a legacy plain string
 * from before ANA-75 -- see `normalizeMaterialContent`. */
export type MaterialDocument = {
  bookId: string;
  moduleId: string;
  content: string | TranslatableString;
};

/** Validates Firestore-sourced data before it's trusted as a `Material`.
 * Accepts a legacy plain-string `content` alongside the current
 * `TranslatableString` shape (ANA-75) -- callers normalize it via
 * `normalizeMaterialContent` before treating it as a real `Material`. */
export function isValidMaterialDocument(
  value: unknown,
): value is MaterialDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return (
    typeof v.bookId === "string" &&
    typeof v.moduleId === "string" &&
    (typeof v.content === "string" || isValidTranslatableString(v.content))
  );
}

/** Normalizes a Material document's `content` into the current
 * `TranslatableString` shape: a legacy plain string (from before ANA-75)
 * becomes `{ ar: <the string>, en: "" }` -- Arabic is this School's primary
 * content language, so an un-translated legacy value reads as the Arabic
 * draft with English still to be written, matching how every other
 * translatable field in this app treats a partially-filled value. Already-
 * translatable content passes through unchanged. */
export function normalizeMaterialContent(
  content: string | TranslatableString,
): TranslatableString {
  return typeof content === "string" ? { ar: content, en: "" } : content;
}
