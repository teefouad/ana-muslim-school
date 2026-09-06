export type Material = {
  id: string;
  bookId: string;
  moduleId: string;
  content: string;
};

export type MaterialWritableFields = {
  bookId: string;
  moduleId: string;
  content: string;
};

/** Validates Firestore-sourced data before it's trusted as a `Material`. */
export function isValidMaterialDocument(
  value: unknown,
): value is Omit<Material, "id"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return (
    typeof v.bookId === "string" &&
    typeof v.moduleId === "string" &&
    typeof v.content === "string"
  );
}
