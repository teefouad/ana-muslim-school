import { hasOnlyAllowedKeys } from "@/lib/http/has-only-allowed-keys";
import { fail, ok, type ParseResult } from "@/lib/http/parse-result";
import { parseTranslatableString } from "@/lib/learning-content/translatable-string";
import type { ModuleWritableFields } from "./types";

const CREATE_KEYS = [
  "title",
  "description",
  "color",
  "isLocked",
  "isPublished",
] as const;

/** Parses a `POST /books/{bookId}/modules` body. All writable fields are required; `lessons`/audit fields are server-controlled. */
export function parseModuleCreateInput(
  body: Record<string, unknown>,
): ParseResult<ModuleWritableFields> {
  if (!hasOnlyAllowedKeys(body, CREATE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  const title = parseTranslatableString(body.title);
  if (!title) return fail("`title` must be a { ar, en } string pair.");

  const description = parseTranslatableString(body.description);
  if (!description) {
    return fail("`description` must be a { ar, en } string pair.");
  }

  if (typeof body.color !== "string") return fail("`color` must be a string.");
  if (typeof body.isLocked !== "boolean") {
    return fail("`isLocked` must be a boolean.");
  }
  if (typeof body.isPublished !== "boolean") {
    return fail("`isPublished` must be a boolean.");
  }

  return ok({
    title,
    description,
    color: body.color,
    isLocked: body.isLocked,
    isPublished: body.isPublished,
  });
}

export type ModulePatchFields = Partial<ModuleWritableFields> & {
  /** Present only when the caller supplied `lessons` -- a same-set reorder, validated against the current order by the service. */
  lessonsReorder?: string[];
};

const PATCH_KEYS = [...CREATE_KEYS, "lessons"] as const;

/** Parses a `PATCH /books/{bookId}/modules/{moduleId}` body. Every field is optional; an omitted field is left unchanged. */
export function parseModulePatchInput(
  body: Record<string, unknown>,
): ParseResult<ModulePatchFields> {
  if (!hasOnlyAllowedKeys(body, PATCH_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (Object.keys(body).length === 0) {
    return fail("Request body must include at least one recognized field.");
  }

  const result: ModulePatchFields = {};

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

  if ("color" in body) {
    if (typeof body.color !== "string")
      return fail("`color` must be a string.");
    result.color = body.color;
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

  if ("lessons" in body) {
    if (
      !Array.isArray(body.lessons) ||
      !body.lessons.every((id) => typeof id === "string")
    ) {
      return fail("`lessons` must be an array of lesson ids.");
    }
    result.lessonsReorder = body.lessons;
  }

  return ok(result);
}
