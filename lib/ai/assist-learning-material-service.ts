import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
import { readOptionalString } from "./read-optional-string";
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
 * Module's own current Arabic Title/Description (ANA-98/ANA-99) --
 * optional since a caller that never tracks either (e.g. the Module
 * Builder import flow) has nothing to supply here. `fullMaterial`, when
 * supplied, is this Module's complete Arabic Learning Material, sent when
 * `text` is only a Markdown selection within it (ANA-99) -- surrounding
 * context only, never a second transformation target. `bilingual: true`
 * (ANA-135) asks for the whole Learning Material back in both Arabic and
 * English; without it (a selection, or the Arabic-only Module Builder import
 * flow) the result is Arabic only.
 */
export async function assistLearningMaterialService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ ar: string; en?: string }>> {
  if (typeof body.bookId !== "string" || body.bookId.trim().length === 0) {
    return fail("invalid-input", "`bookId` must be a non-empty string.");
  }

  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  const moduleTitle = readOptionalString(body.moduleTitle);
  if (!moduleTitle.ok) {
    return fail("invalid-input", "`moduleTitle` must be a string.");
  }

  const moduleDescription = readOptionalString(body.moduleDescription);
  if (!moduleDescription.ok) {
    return fail("invalid-input", "`moduleDescription` must be a string.");
  }

  const fullMaterial = readOptionalString(body.fullMaterial);
  if (!fullMaterial.ok) {
    return fail("invalid-input", "`fullMaterial` must be a string.");
  }

  if (body.bilingual !== undefined && typeof body.bilingual !== "boolean") {
    return fail("invalid-input", "`bilingual` must be a boolean.");
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
    const result = await refineLearningMaterial(
      body.text,
      {
        title: bookResult.value.title,
        description: bookResult.value.description,
        longDescription: bookResult.value.longDescription,
      },
      { title: moduleTitle.value, description: moduleDescription.value },
      fullMaterial.value,
      additionalInstructions,
      body.bilingual === true,
    );

    return ok(result);
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail("upstream-error", "AI Assistant failed. Please try again.");
    }

    throw error;
  }
}
