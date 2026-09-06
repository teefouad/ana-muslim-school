import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { hasOnlyAllowedKeys } from "@/lib/http/has-only-allowed-keys";
import { fail, ok, type ParseResult } from "@/lib/http/parse-result";
import type { MaterialWritableFields } from "./types";

const WRITABLE_KEYS = ["bookId", "moduleId", "content"] as const;

/**
 * Parses a `POST /materials` or `PUT /materials/{materialId}` body -- both
 * require the complete writable shape (see ANA-62).
 */
export function parseMaterialWritableInput(
  body: Record<string, unknown>,
): ParseResult<MaterialWritableFields> {
  if (!hasOnlyAllowedKeys(body, WRITABLE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (typeof body.bookId !== "string" || !isValidDocId(body.bookId)) {
    return fail("`bookId` must be a valid document id.");
  }

  if (typeof body.moduleId !== "string" || !isValidDocId(body.moduleId)) {
    return fail("`moduleId` must be a valid document id.");
  }

  if (typeof body.content !== "string") {
    return fail("`content` must be a string.");
  }

  return ok({
    bookId: body.bookId,
    moduleId: body.moduleId,
    content: body.content,
  });
}

/** Parses a `PATCH /materials/{materialId}` body. Every field is optional; an omitted field is left unchanged. */
export function parseMaterialPatchInput(
  body: Record<string, unknown>,
): ParseResult<Partial<MaterialWritableFields>> {
  if (!hasOnlyAllowedKeys(body, WRITABLE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (Object.keys(body).length === 0) {
    return fail("Request body must include at least one recognized field.");
  }

  const result: Partial<MaterialWritableFields> = {};

  if ("bookId" in body) {
    if (typeof body.bookId !== "string" || !isValidDocId(body.bookId)) {
      return fail("`bookId` must be a valid document id.");
    }
    result.bookId = body.bookId;
  }

  if ("moduleId" in body) {
    if (typeof body.moduleId !== "string" || !isValidDocId(body.moduleId)) {
      return fail("`moduleId` must be a valid document id.");
    }
    result.moduleId = body.moduleId;
  }

  if ("content" in body) {
    if (typeof body.content !== "string") {
      return fail("`content` must be a string.");
    }
    result.content = body.content;
  }

  return ok(result);
}
