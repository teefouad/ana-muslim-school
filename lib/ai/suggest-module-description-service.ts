import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { readBasePrompt } from "./read-base-prompt";
import { AiTaskError } from "./run-ai-task";
import { suggestModuleDescription } from "./suggest-module-description";

/**
 * Validates and runs the Module Description AI Assistant request for
 * `POST /api/v1/ai/assist` (`field: "description"`, ANA-98). The client
 * always sends `bookId` -- the Book itself is always loaded server-side
 * here from it, never trusted from the request body. `text` (the current
 * description) may be empty: `moduleTitle` and `moduleContent` -- this
 * Module's own Arabic Title and Learning Material (ANA-99) -- are the
 * required context a description can be drafted from even before this
 * Module has one.
 */
export async function suggestModuleDescriptionService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.bookId !== "string" || body.bookId.trim().length === 0) {
    return fail("invalid-input", "`bookId` must be a non-empty string.");
  }

  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  if (typeof body.moduleTitle !== "string") {
    return fail("invalid-input", "`moduleTitle` must be a string.");
  }

  if (typeof body.moduleContent !== "string") {
    return fail("invalid-input", "`moduleContent` must be a string.");
  }

  const additionalInstructions =
    typeof body.additionalInstructions === "string"
      ? body.additionalInstructions.trim() || undefined
      : undefined;

  const basePrompt = readBasePrompt(body.basePrompt);

  if (!basePrompt.ok) {
    return fail("invalid-input", basePrompt.message);
  }

  const bookResult = await getBookByIdService(body.bookId);

  if (!bookResult.ok) {
    return bookResult;
  }

  try {
    const text = await suggestModuleDescription(
      body.text,
      body.moduleTitle,
      body.moduleContent,
      {
        title: bookResult.value.title,
        description: bookResult.value.description,
        longDescription: bookResult.value.longDescription,
      },
      additionalInstructions,
      basePrompt.value,
    );

    return ok({ text });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail("upstream-error", "AI Assistant failed. Please try again.");
    }

    throw error;
  }
}
