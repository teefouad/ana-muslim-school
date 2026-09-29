import "server-only";

import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import {
  loadBookModuleContext,
  readModuleSelection,
} from "./book-module-context";
import { readOptionalString } from "./read-optional-string";
import { AiTaskError } from "./run-ai-task";
import type { BilingualText } from "./run-bilingual-ai-task";
import { suggestBookLongDescription } from "./suggest-book-long-description";

/**
 * Validates and runs the Book Long Description AI Assistant request for
 * `POST /api/v1/ai/assist` (`field: "bookLongDescription"`, ANA-100).
 * Unlike every Module-level `field` this endpoint also serves, this never
 * loads a Book server-side -- a Book's own fields (`bookTitle`/
 * `bookDescription` here) are always this same Book, trusted directly from
 * the request body, so this works identically for a Book that hasn't been
 * created yet (Add Book) and one being edited. `text` (the current long
 * description) may be empty: `bookTitle`/`bookDescription` context alone
 * can be enough to draft a long description for a Book that has neither
 * yet. `language` is the language of the Long Description field actually
 * being written (PR review) -- required, since FormField's AI Assistance
 * operates on whichever language tab is active and must write the result
 * back to that same language, not always Arabic.
 * ANA-133: optional `bookId` + `moduleIds` add the selected Modules' content
 * as extra context -- loaded server-side (only Modules of that Book), never
 * trusted from the request body.
 */
export async function suggestBookLongDescriptionService(
  body: Record<string, unknown>,
): Promise<ServiceResult<BilingualText>> {
  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  if (typeof body.bookTitle !== "string") {
    return fail("invalid-input", "`bookTitle` must be a string.");
  }

  if (typeof body.bookDescription !== "string") {
    return fail("invalid-input", "`bookDescription` must be a string.");
  }

  const textEn = readOptionalString(body.textEn);
  if (!textEn.ok) {
    return fail("invalid-input", "`textEn` must be a string.");
  }

  const bookTitleEn = readOptionalString(body.bookTitleEn);
  if (!bookTitleEn.ok) {
    return fail("invalid-input", "`bookTitleEn` must be a string.");
  }

  const bookDescriptionEn = readOptionalString(body.bookDescriptionEn);
  if (!bookDescriptionEn.ok) {
    return fail("invalid-input", "`bookDescriptionEn` must be a string.");
  }

  const selection = readModuleSelection(body);

  if (!selection.ok) {
    return selection;
  }

  let moduleContext: string | undefined;

  if (selection.value) {
    const loaded = await loadBookModuleContext(selection.value);

    if (!loaded.ok) {
      return loaded;
    }

    moduleContext = loaded.value;
  }

  const additionalInstructions =
    typeof body.additionalInstructions === "string"
      ? body.additionalInstructions.trim() || undefined
      : undefined;

  try {
    const result = await suggestBookLongDescription(
      { ar: body.text, en: textEn.value ?? "" },
      { ar: body.bookTitle, en: bookTitleEn.value ?? "" },
      { ar: body.bookDescription, en: bookDescriptionEn.value ?? "" },
      additionalInstructions,
      moduleContext,
    );

    return ok(result);
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail("upstream-error", "AI Assistant failed. Please try again.");
    }

    throw error;
  }
}
