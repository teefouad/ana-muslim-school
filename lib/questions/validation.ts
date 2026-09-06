import { hasOnlyAllowedKeys } from "@/lib/http/has-only-allowed-keys";
import { fail, ok, type ParseResult } from "@/lib/http/parse-result";
import { parseTranslatableString } from "@/lib/learning-content/translatable-string";
import type { QuestionChoice, QuestionWritableFields } from "./types";

function parseChoices(value: unknown): QuestionChoice[] | null {
  if (!Array.isArray(value)) return null;

  const choices: QuestionChoice[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const v = item as Record<string, unknown>;
    if (Object.keys(v).length !== 2) return null;

    const text = parseTranslatableString(v.text);
    if (!text || typeof v.isCorrect !== "boolean") return null;

    choices.push({ text, isCorrect: v.isCorrect });
  }

  return choices;
}

const CREATE_KEYS = ["text", "explanation", "choices"] as const;

/** Parses a `POST /books/{bookId}/modules/{moduleId}/questions` body. Every writable field is required. */
export function parseQuestionCreateInput(
  body: Record<string, unknown>,
): ParseResult<QuestionWritableFields> {
  if (!hasOnlyAllowedKeys(body, CREATE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  const text = parseTranslatableString(body.text);
  if (!text) return fail("`text` must be a { ar, en } string pair.");

  const explanation = parseTranslatableString(body.explanation);
  if (!explanation) {
    return fail("`explanation` must be a { ar, en } string pair.");
  }

  const choices = parseChoices(body.choices);
  if (!choices) {
    return fail("`choices` must be an array of { text, isCorrect } entries.");
  }

  return ok({ text, explanation, choices });
}

const PATCH_KEYS = CREATE_KEYS;

/** Parses a `PATCH /books/{bookId}/modules/{moduleId}/questions/{questionId}` body. Every field is optional. */
export function parseQuestionPatchInput(
  body: Record<string, unknown>,
): ParseResult<Partial<QuestionWritableFields>> {
  if (!hasOnlyAllowedKeys(body, PATCH_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (Object.keys(body).length === 0) {
    return fail("Request body must include at least one recognized field.");
  }

  const result: Partial<QuestionWritableFields> = {};

  if ("text" in body) {
    const text = parseTranslatableString(body.text);
    if (!text) return fail("`text` must be a { ar, en } string pair.");
    result.text = text;
  }

  if ("explanation" in body) {
    const explanation = parseTranslatableString(body.explanation);
    if (!explanation) {
      return fail("`explanation` must be a { ar, en } string pair.");
    }
    result.explanation = explanation;
  }

  if ("choices" in body) {
    const choices = parseChoices(body.choices);
    if (!choices) {
      return fail("`choices` must be an array of { text, isCorrect } entries.");
    }
    result.choices = choices;
  }

  return ok(result);
}
