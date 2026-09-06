import {
  isValidTranslatableString,
  type TranslatableString,
} from "@/lib/learning-content/translatable-string";

export type QuestionChoice = {
  text: TranslatableString;
  isCorrect: boolean;
};

export type Question = {
  id: string;
  text: TranslatableString;
  explanation: TranslatableString;
  choices: QuestionChoice[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type QuestionWritableFields = Omit<
  Question,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

function isValidChoice(value: unknown): value is QuestionChoice {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return isValidTranslatableString(v.text) && typeof v.isCorrect === "boolean";
}

/** Validates Firestore-sourced data before it's trusted as a `Question`. */
export function isValidQuestionDocument(value: unknown): value is Omit<
  Question,
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
    isValidTranslatableString(v.text) &&
    isValidTranslatableString(v.explanation) &&
    Array.isArray(v.choices) &&
    v.choices.every(isValidChoice) &&
    typeof v.createdBy === "string" &&
    typeof v.updatedBy === "string"
  );
}
