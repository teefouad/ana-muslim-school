export type Source = {
  id: string;
  bookId: string;
  content: string;
};

export type SourceWritableFields = {
  bookId: string;
  content: string;
};

/** Validates Firestore-sourced data before it's trusted as a `Source`. */
export function isValidSourceDocument(
  value: unknown,
): value is Omit<Source, "id"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return typeof v.bookId === "string" && typeof v.content === "string";
}
