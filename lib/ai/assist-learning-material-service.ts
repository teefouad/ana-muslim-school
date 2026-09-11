import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { parseTranslatableString } from "@/lib/learning-content/translatable-string";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
import { refineLearningMaterial } from "./refine-learning-material";

/**
 * Validates and runs the Module AI Assistant request for
 * `POST /api/v1/ai/assist` (ANA-85), `field: "content"` (or omitted, its
 * default). The client always sends `bookId` -- the Book itself is always
 * loaded server-side here from it, never trusted from the request body.
 * `text` may be empty (ANA-98): caller-supplied Module/Book context alone
 * can be enough to draft Learning Material for a Module that has none yet,
 * matching the Title/Description assist services' own "empty is valid"
 * rule. `moduleTitle`/`moduleDescription`, when supplied, are this same
 * Module's own current Title/Description (ANA-98) -- optional since a
 * caller that never tracks either (e.g. the Module Builder import flow)
 * has nothing to supply here.
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

  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  let moduleTitle;
  if (body.moduleTitle !== undefined) {
    moduleTitle = parseTranslatableString(body.moduleTitle);
    if (!moduleTitle) {
      return fail(
        "invalid-input",
        "`moduleTitle` must be a `{ ar, en }` object.",
      );
    }
  }

  let moduleDescription;
  if (body.moduleDescription !== undefined) {
    moduleDescription = parseTranslatableString(body.moduleDescription);
    if (!moduleDescription) {
      return fail(
        "invalid-input",
        "`moduleDescription` must be a `{ ar, en }` object.",
      );
    }
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
      { title: moduleTitle, description: moduleDescription },
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
