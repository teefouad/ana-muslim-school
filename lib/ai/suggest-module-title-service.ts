import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { parseTranslatableString } from "@/lib/learning-content/translatable-string";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
import { suggestModuleTitle } from "./suggest-module-title";

/**
 * Validates and runs the Module Title AI Assistant request for
 * `POST /api/v1/ai/assist` (`field: "title"`, ANA-98). The client always
 * sends `bookId` -- the Book itself is always loaded server-side here from
 * it, never trusted from the request body. `text` (the current title) may
 * be empty: `moduleContent` -- this Module's own Learning Material -- is
 * the required context a title can be drafted from even before this
 * Module has one.
 */
export async function suggestModuleTitleService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.bookId !== "string" || body.bookId.trim().length === 0) {
    return fail("invalid-input", "`bookId` must be a non-empty string.");
  }

  if (body.language !== "ar" && body.language !== "en") {
    return fail("invalid-input", '`language` must be "ar" or "en".');
  }

  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  const moduleContent = parseTranslatableString(body.moduleContent);

  if (!moduleContent) {
    return fail(
      "invalid-input",
      "`moduleContent` must be a `{ ar, en }` object.",
    );
  }

  const additionalInstructions =
    typeof body.additionalInstructions === "string"
      ? body.additionalInstructions.trim() || undefined
      : undefined;

  const bookResult = await getBookByIdService(body.bookId);

  if (!bookResult.ok) {
    return bookResult;
  }

  try {
    const text = await suggestModuleTitle(
      body.text,
      moduleContent,
      {
        title: bookResult.value.title,
        description: bookResult.value.description,
        longDescription: bookResult.value.longDescription,
      },
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
