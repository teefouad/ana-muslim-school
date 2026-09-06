import {
  isValidTranslatableString,
  type TranslatableString,
} from "@/lib/learning-content/translatable-string";

export const LESSON_TYPES = [
  "text",
  "video",
  "quiz",
  "final",
  "skip",
  "break",
] as const;

export type LessonType = (typeof LESSON_TYPES)[number];

export type LessonAzkarEntry = {
  text: TranslatableString;
  repeat: number;
};

export type Lesson = {
  id: string;
  title: TranslatableString;
  description: TranslatableString;
  type: LessonType;
  /** An ordinary client-controlled numeric field with no backend-defined relationship to `Module.lessons` order (see ANA-62). */
  position: number;
  reward: { coins: number };
  duration: number;
  videoURL: string;
  azkar: LessonAzkarEntry[];
  /** References to Question documents from the same Module -- see lib/lessons/lessons-service.ts. */
  questions: string[];
  isLocked: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type LessonWritableFields = Omit<
  Lesson,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

function isValidAzkarEntry(value: unknown): value is LessonAzkarEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return isValidTranslatableString(v.text) && typeof v.repeat === "number";
}

/** Validates Firestore-sourced data before it's trusted as a `Lesson`. */
export function isValidLessonDocument(value: unknown): value is Omit<
  Lesson,
  "id" | "createdAt" | "updatedAt"
> & {
  createdAt: unknown;
  updatedAt: unknown;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;
  const reward = v.reward as Record<string, unknown> | undefined;

  return (
    isValidTranslatableString(v.title) &&
    isValidTranslatableString(v.description) &&
    typeof v.type === "string" &&
    (LESSON_TYPES as readonly string[]).includes(v.type) &&
    typeof v.position === "number" &&
    Boolean(reward) &&
    typeof reward === "object" &&
    typeof reward.coins === "number" &&
    typeof v.duration === "number" &&
    typeof v.videoURL === "string" &&
    Array.isArray(v.azkar) &&
    v.azkar.every(isValidAzkarEntry) &&
    Array.isArray(v.questions) &&
    v.questions.every((id) => typeof id === "string") &&
    typeof v.isLocked === "boolean" &&
    typeof v.isPublished === "boolean" &&
    typeof v.createdBy === "string" &&
    typeof v.updatedBy === "string"
  );
}
