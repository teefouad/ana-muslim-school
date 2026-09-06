import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { hasOnlyAllowedKeys } from "@/lib/http/has-only-allowed-keys";
import { fail, ok, type ParseResult } from "@/lib/http/parse-result";
import type { SourceWritableFields } from "./types";

const WRITABLE_KEYS = ["bookId", "content"] as const;

/** Parses a `POST /sources` body. Both fields are required. */
export function parseSourceCreateInput(
  body: Record<string, unknown>,
): ParseResult<SourceWritableFields> {
  if (!hasOnlyAllowedKeys(body, WRITABLE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (typeof body.bookId !== "string" || !isValidDocId(body.bookId)) {
    return fail("`bookId` must be a valid document id.");
  }

  if (typeof body.content !== "string") {
    return fail("`content` must be a string.");
  }

  return ok({ bookId: body.bookId, content: body.content });
}

/** Parses a `PATCH /sources/{sourceId}` body. Every field is optional; an omitted field is left unchanged. */
export function parseSourcePatchInput(
  body: Record<string, unknown>,
): ParseResult<Partial<SourceWritableFields>> {
  if (!hasOnlyAllowedKeys(body, WRITABLE_KEYS)) {
    return fail("Request body contains unknown or non-writable fields.");
  }

  if (Object.keys(body).length === 0) {
    return fail("Request body must include at least one recognized field.");
  }

  const result: Partial<SourceWritableFields> = {};

  if ("bookId" in body) {
    if (typeof body.bookId !== "string" || !isValidDocId(body.bookId)) {
      return fail("`bookId` must be a valid document id.");
    }
    result.bookId = body.bookId;
  }

  if ("content" in body) {
    if (typeof body.content !== "string") {
      return fail("`content` must be a string.");
    }
    result.content = body.content;
  }

  return ok(result);
}
