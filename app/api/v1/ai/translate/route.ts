import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { translateArabicToEnglishService } from "@/lib/ai/translate-service";
import { translateModuleFieldService } from "@/lib/ai/translate-module-field-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";

/**
 * Translates a Module's Arabic draft to English. With no `field` in the
 * request body, this is ANA-77's original plain, context-free
 * Arabic -> English translation -- the only server boundary
 * `translateArabicToEnglishService` (`lib/ai/translate-service.ts`) is
 * called from, never the generic `runAiTask` executor directly. With
 * `field` set to `"title"`, `"description"`, or `"content"` (ANA-98), this
 * instead runs a context-aware translation that loads the owning Book
 * server-side from a client-supplied `bookId` and accepts this same
 * Module's other, already-filled-in fields as orientation context, so the
 * translation preserves the meaning appropriate to that specific field
 * rather than translating an isolated string. Both paths are treated as a
 * Books authoring action, so both require `books.update` like every other
 * Source/Module/Material mutation (see lib/auth/require-books-permission.ts).
 * Never persists anything itself; the caller applies the returned text to
 * its own draft state.
 */
export async function POST(request: Request) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const field = body.value.field;

  if (
    field !== undefined &&
    field !== "title" &&
    field !== "description" &&
    field !== "content"
  ) {
    return NextResponse.json(
      { error: '`field` must be "title", "description", or "content".' },
      { status: 400 },
    );
  }

  const result = field
    ? await translateModuleFieldService(body.value)
    : await translateArabicToEnglishService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
