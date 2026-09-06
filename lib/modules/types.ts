import {
  isValidTranslatableString,
  type TranslatableString,
} from "@/lib/learning-content/translatable-string";

export type Module = {
  id: string;
  title: TranslatableString;
  description: TranslatableString;
  color: string;
  lessons: string[];
  isLocked: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

/** The fields a caller may write when creating a Module. `lessons` is always server-initialized to `[]`. */
export type ModuleWritableFields = {
  title: TranslatableString;
  description: TranslatableString;
  color: string;
  isLocked: boolean;
  isPublished: boolean;
};

/** Validates Firestore-sourced data before it's trusted as a `Module`. */
export function isValidModuleDocument(value: unknown): value is Omit<
  Module,
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
    typeof v.color === "string" &&
    Array.isArray(v.lessons) &&
    v.lessons.every((id) => typeof id === "string") &&
    typeof v.isLocked === "boolean" &&
    typeof v.isPublished === "boolean" &&
    typeof v.createdBy === "string" &&
    typeof v.updatedBy === "string"
  );
}
