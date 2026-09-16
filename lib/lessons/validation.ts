import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { hasOnlyAllowedKeys } from "@/lib/http/has-only-allowed-keys";
import { fail, ok, type ParseResult } from "@/lib/http/parse-result";
import { parseTranslatableString } from "@/lib/learning-content/translatable-string";
import {
  LESSON_TYPES,
  type LessonAzkarEntry,
  type LessonWritableFields,
} from "./types";

function parseReward(value: unknown): { coins: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Number.isFinite(v.coins) || Object.keys(v).length !== 1) return null;
  return { coins: v.coins as number };
}

function parseAzkar(value: unknown): LessonAzkarEntry[] | null {
  if (!Array.isArray(value)) return null;

  const entries: LessonAzkarEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const v = item as Record<string, unknown>;
    if (Object.keys(v).length !== 2) return null;

    const text = parseTranslatableString(v.text);
    if (!text || !Number.isFinite(v.repeat)) return null;

    entries.push({ text, repeat: v.repeat as number });
  }

  return entries;
}

/**
 * Parses a `questions` array's shape only (strings, no duplicates) -- whether
 * each id actually exists and belongs to the same Module is a relationship
 * check the service makes against the repository (see
 * lib/lessons/lessons-service.ts).
 */
function parseQuestionIds(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((id) => typeof id === "string" && isValidDocId(id))
  ) {
    return null;
  }

  if (new Set(value).size !== value.length) {
    return null;
  }

  return value;
}

const CREATE_KEYS = [
  "title",
  "description",
  "type",
  "position",
  "reward",
  "content",
  "duration",
  "videoURL",
  "azkar",
  "questions",
  "isLocked",
  "isPublished",
] as const;

/** Parses a `POST /books/{bookId}/modules/{moduleId}/lessons` body. Every writable field is required. */
export function parseLessonCreateInput(
  body: Record<string, unknown>,
): ParseResult<LessonWritableFields> {
  if (!hasOnlyAllowedKeys(body, CREATE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  const title = parseTranslatableString(body.title);
  if (!title) return fail("`title` must be a { ar, en } string pair.");

  const description = parseTranslatableString(body.description);
  if (!description) {
    return fail("`description` must be a { ar, en } string pair.");
  }

  if (
    typeof body.type !== "string" ||
    !(LESSON_TYPES as readonly string[]).includes(body.type)
  ) {
    return fail(`\`type\` must be one of: ${LESSON_TYPES.join(", ")}.`);
  }

  if (!Number.isFinite(body.position)) {
    return fail("`position` must be a finite number.");
  }

  const reward = parseReward(body.reward);
  if (!reward) return fail("`reward` must be a { coins: number } object.");

  const content = parseTranslatableString(body.content);
  if (!content) return fail("`content` must be a { ar, en } string pair.");

  if (!Number.isFinite(body.duration)) {
    return fail("`duration` must be a finite number.");
  }

  if (typeof body.videoURL !== "string") {
    return fail("`videoURL` must be a string.");
  }

  const azkar = parseAzkar(body.azkar);
  if (!azkar) {
    return fail("`azkar` must be an array of { text, repeat } entries.");
  }

  const questions = parseQuestionIds(body.questions);
  if (!questions) {
    return fail("`questions` must be an array of unique question ids.");
  }

  if (typeof body.isLocked !== "boolean") {
    return fail("`isLocked` must be a boolean.");
  }
  if (typeof body.isPublished !== "boolean") {
    return fail("`isPublished` must be a boolean.");
  }

  return ok({
    title,
    description,
    type: body.type as LessonWritableFields["type"],
    position: body.position as number,
    reward,
    content,
    duration: body.duration as number,
    videoURL: body.videoURL,
    azkar,
    questions,
    isLocked: body.isLocked,
    isPublished: body.isPublished,
  });
}

const PATCH_KEYS = CREATE_KEYS;

/** Parses a `PATCH /books/{bookId}/modules/{moduleId}/lessons/{lessonId}` body. Every field is optional; an omitted field is left unchanged. */
export function parseLessonPatchInput(
  body: Record<string, unknown>,
): ParseResult<Partial<LessonWritableFields>> {
  if (!hasOnlyAllowedKeys(body, PATCH_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (Object.keys(body).length === 0) {
    return fail("Request body must include at least one recognized field.");
  }

  const result: Partial<LessonWritableFields> = {};

  if ("title" in body) {
    const title = parseTranslatableString(body.title);
    if (!title) return fail("`title` must be a { ar, en } string pair.");
    result.title = title;
  }

  if ("description" in body) {
    const description = parseTranslatableString(body.description);
    if (!description) {
      return fail("`description` must be a { ar, en } string pair.");
    }
    result.description = description;
  }

  if ("type" in body) {
    if (
      typeof body.type !== "string" ||
      !(LESSON_TYPES as readonly string[]).includes(body.type)
    ) {
      return fail(`\`type\` must be one of: ${LESSON_TYPES.join(", ")}.`);
    }
    result.type = body.type as LessonWritableFields["type"];
  }

  if ("position" in body) {
    if (!Number.isFinite(body.position)) {
      return fail("`position` must be a finite number.");
    }
    result.position = body.position as number;
  }

  if ("reward" in body) {
    const reward = parseReward(body.reward);
    if (!reward) return fail("`reward` must be a { coins: number } object.");
    result.reward = reward;
  }

  if ("content" in body) {
    const content = parseTranslatableString(body.content);
    if (!content) return fail("`content` must be a { ar, en } string pair.");
    result.content = content;
  }

  if ("duration" in body) {
    if (!Number.isFinite(body.duration)) {
      return fail("`duration` must be a finite number.");
    }
    result.duration = body.duration as number;
  }

  if ("videoURL" in body) {
    if (typeof body.videoURL !== "string") {
      return fail("`videoURL` must be a string.");
    }
    result.videoURL = body.videoURL;
  }

  if ("azkar" in body) {
    const azkar = parseAzkar(body.azkar);
    if (!azkar) {
      return fail("`azkar` must be an array of { text, repeat } entries.");
    }
    result.azkar = azkar;
  }

  if ("questions" in body) {
    const questions = parseQuestionIds(body.questions);
    if (!questions) {
      return fail("`questions` must be an array of unique question ids.");
    }
    result.questions = questions;
  }

  if ("isLocked" in body) {
    if (typeof body.isLocked !== "boolean") {
      return fail("`isLocked` must be a boolean.");
    }
    result.isLocked = body.isLocked;
  }

  if ("isPublished" in body) {
    if (typeof body.isPublished !== "boolean") {
      return fail("`isPublished` must be a boolean.");
    }
    result.isPublished = body.isPublished;
  }

  return ok(result);
}
