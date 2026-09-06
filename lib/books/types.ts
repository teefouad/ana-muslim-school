import {
  isValidTranslatableString,
  type TranslatableString,
} from "@/lib/learning-content/translatable-string";

export type Book = {
  id: string;
  title: TranslatableString;
  description: TranslatableString;
  longDescription: TranslatableString;
  color: string;
  imageId: string;
  modules: string[];
  isLocked: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

/** The fields a caller may write when creating a Book. `modules` is always server-initialized to `[]`. */
export type BookWritableFields = {
  title: TranslatableString;
  description: TranslatableString;
  longDescription: TranslatableString;
  color: string;
  imageId: string;
  isLocked: boolean;
  isPublished: boolean;
};

/** Validates Firestore-sourced data before it's trusted as a `Book` -- a hand-edited or partially-written document must fail closed. */
export function isValidBookDocument(value: unknown): value is Omit<
  Book,
  "id" | "createdAt" | "updatedAt"
> & {
  createdAt: unknown;
  updatedAt: unknown;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return (
    isValidTranslatableString(v.title) &&
    isValidTranslatableString(v.description) &&
    isValidTranslatableString(v.longDescription) &&
    typeof v.color === "string" &&
    typeof v.imageId === "string" &&
    Array.isArray(v.modules) &&
    v.modules.every((id) => typeof id === "string") &&
    typeof v.isLocked === "boolean" &&
    typeof v.isPublished === "boolean" &&
    typeof v.createdBy === "string" &&
    typeof v.updatedBy === "string"
  );
}
