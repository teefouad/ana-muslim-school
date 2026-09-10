import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
import { refineLearningMaterial } from "./refine-learning-material";

/**
 * Validates and runs the Module AI Assistant request for
 * `POST /api/v1/ai/assist` (ANA-85). The client only ever sends `bookId`,
 * `text`, `language`, and optional `additionalInstructions` -- the Book
 * itself is always loaded server-side here from `bookId`, never trusted from
 * the request body, and this is the only server boundary that calls the
 * specialized `refineLearningMaterial()` helper for this workflow.
 */
export async function assistLearningMaterialService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.bookId !== "string" || body.bookId.trim().length === 0) {
    return fail("invalid-input", "`bookId` must be a non-empty string.");
  }

  if (body.language !== "ar" && body.language !== "en") {
    return fail("invalid-input", '`language` must be "ar" or "en".');
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return fail("invalid-input", "`text` must be a non-empty string.");
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
    const text = await refineLearningMaterial(
      body.text,
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
