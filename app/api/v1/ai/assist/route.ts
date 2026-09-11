import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { assistLearningMaterialService } from "@/lib/ai/assist-learning-material-service";
import { suggestBookDescriptionService } from "@/lib/ai/suggest-book-description-service";
import { suggestBookLongDescriptionService } from "@/lib/ai/suggest-book-long-description-service";
import { suggestModuleDescriptionService } from "@/lib/ai/suggest-module-description-service";
import { suggestModuleTitleService } from "@/lib/ai/suggest-module-title-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";

const FIELDS = [
  "title",
  "description",
  "content",
  "bookDescription",
  "bookLongDescription",
] as const;

/**
 * Runs one of this dashboard's AI Assistant tasks. `field` selects which
 * target the request refines: `"content"` (the default when omitted --
 * ANA-85's original Learning Material assist, extended in ANA-98 to
 * optionally also take this Module's own title/description as context),
 * `"title"`/`"description"` (Module-level, ANA-98) -- each of those three
 * backed by its own specialized lib/ai helper and validated by its own
 * service, and each always reloading its owning Book server-side from a
 * client-supplied `bookId`, never trusted from the request body -- versus
 * `"bookDescription"`/`"bookLongDescription"` (Book-level, ANA-100), which
 * never load a Book server-side at all: a Book's own fields are always
 * this same Book (there is no separate owning entity to fetch, and no
 * `bookId` when the Book hasn't been created yet), so `bookTitle`/
 * `bookDescription`/`bookLongDescription` context is trusted directly from
 * the request body for those two, the same way a Module's own current
 * title/content are trusted for Module-level AI Assistance. Every `field`
 * shares this one REST boundary and `books.update` permission check (see
 * lib/auth/require-books-permission.ts). Never persists anything itself --
 * the caller applies the returned text to its own draft state.
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
    !FIELDS.includes(field as (typeof FIELDS)[number])
  ) {
    return NextResponse.json(
      {
        error:
          '`field` must be "title", "description", "content", "bookDescription", or "bookLongDescription".',
      },
      { status: 400 },
    );
  }

  const result =
    field === "title"
      ? await suggestModuleTitleService(body.value)
      : field === "description"
        ? await suggestModuleDescriptionService(body.value)
        : field === "bookDescription"
          ? await suggestBookDescriptionService(body.value)
          : field === "bookLongDescription"
            ? await suggestBookLongDescriptionService(body.value)
            : await assistLearningMaterialService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
