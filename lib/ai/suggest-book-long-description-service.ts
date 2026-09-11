import "server-only";

import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
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
 */
export async function suggestBookLongDescriptionService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  if (typeof body.bookTitle !== "string") {
    return fail("invalid-input", "`bookTitle` must be a string.");
  }

  if (typeof body.bookDescription !== "string") {
    return fail("invalid-input", "`bookDescription` must be a string.");
  }

  if (body.language !== "ar" && body.language !== "en") {
    return fail("invalid-input", '`language` must be "ar" or "en".');
  }

  const additionalInstructions =
    typeof body.additionalInstructions === "string"
      ? body.additionalInstructions.trim() || undefined
      : undefined;

  try {
    const text = await suggestBookLongDescription(
      body.text,
      body.bookTitle,
      body.bookDescription,
      body.language,
      additionalInstructions,
    );

    return ok({ text });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail("upstream-error", "AI Assistant failed. Please try again.");
    }

    throw error;
  }
}
