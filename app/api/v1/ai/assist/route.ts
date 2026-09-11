import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { assistLearningMaterialService } from "@/lib/ai/assist-learning-material-service";
import { suggestModuleDescriptionService } from "@/lib/ai/suggest-module-description-service";
import { suggestModuleTitleService } from "@/lib/ai/suggest-module-title-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";

/**
 * Runs one of this dashboard's Module AI Assistant tasks, with Book (and,
 * for `"title"`/`"description"`, Module) context. `field` selects which
 * target the request refines: `"content"` (the default when omitted --
 * ANA-85's original Learning Material assist, extended in ANA-98 to
 * optionally also take this Module's own title/description as context),
 * `"title"`, or `"description"` (both new in ANA-98) -- each backed by its
 * own specialized lib/ai helper and validated by its own service, but
 * sharing this one REST boundary and `books.update` permission check (see
 * lib/auth/require-books-permission.ts). The client always sends `bookId`;
 * the Book itself is loaded server-side from it, never trusted from the
 * request body. Never persists anything itself -- the caller applies the
 * returned text to its own draft state.
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

  const result =
    field === "title"
      ? await suggestModuleTitleService(body.value)
      : field === "description"
        ? await suggestModuleDescriptionService(body.value)
        : await assistLearningMaterialService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
