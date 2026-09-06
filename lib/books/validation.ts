import { hasOnlyAllowedKeys } from "@/lib/http/has-only-allowed-keys";
import { fail, ok, type ParseResult } from "@/lib/http/parse-result";
import { parseTranslatableString } from "@/lib/learning-content/translatable-string";
import type { BookWritableFields } from "./types";

const CREATE_KEYS = [
  "title",
  "description",
  "longDescription",
  "color",
  "imageId",
  "isLocked",
  "isPublished",
] as const;

/** Parses a `POST /books` body. All writable fields are required; `modules`/audit fields are server-controlled. */
export function parseBookCreateInput(
  body: Record<string, unknown>,
): ParseResult<BookWritableFields> {
  if (!hasOnlyAllowedKeys(body, CREATE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  const title = parseTranslatableString(body.title);
  if (!title) return fail("`title` must be a { ar, en } string pair.");

  const description = parseTranslatableString(body.description);
  if (!description) {
    return fail("`description` must be a { ar, en } string pair.");
  }

  const longDescription = parseTranslatableString(body.longDescription);
  if (!longDescription) {
    return fail("`longDescription` must be a { ar, en } string pair.");
  }

  if (typeof body.color !== "string") return fail("`color` must be a string.");
  if (typeof body.imageId !== "string") {
    return fail("`imageId` must be a string.");
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
    longDescription,
    color: body.color,
    imageId: body.imageId,
    isLocked: body.isLocked,
    isPublished: body.isPublished,
  });
}

export type BookPatchFields = Partial<BookWritableFields> & {
  /** Present only when the caller supplied `modules` -- a same-set reorder, validated against the current order by the service. */
  modulesReorder?: string[];
};

const PATCH_KEYS = [...CREATE_KEYS, "modules"] as const;

/** Parses a `PATCH /books/{bookId}` body. Every field is optional; an omitted field is left unchanged. */
export function parseBookPatchInput(
  body: Record<string, unknown>,
): ParseResult<BookPatchFields> {
  if (!hasOnlyAllowedKeys(body, PATCH_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (Object.keys(body).length === 0) {
    return fail("Request body must include at least one recognized field.");
  }

  const result: BookPatchFields = {};

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

  if ("longDescription" in body) {
    const longDescription = parseTranslatableString(body.longDescription);
    if (!longDescription) {
      return fail("`longDescription` must be a { ar, en } string pair.");
    }
    result.longDescription = longDescription;
  }

  if ("color" in body) {
    if (typeof body.color !== "string")
      return fail("`color` must be a string.");
    result.color = body.color;
  }

  if ("imageId" in body) {
    if (typeof body.imageId !== "string") {
      return fail("`imageId` must be a string.");
    }
    result.imageId = body.imageId;
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

  if ("modules" in body) {
    if (
      !Array.isArray(body.modules) ||
      !body.modules.every((id) => typeof id === "string")
    ) {
      return fail("`modules` must be an array of module ids.");
    }
    result.modulesReorder = body.modules;
  }

  return ok(result);
}
