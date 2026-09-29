import "server-only";

import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { readBasePrompt } from "./read-base-prompt";
import { AiTaskError } from "./run-ai-task";
import { suggestLessonTitle } from "./suggest-lesson-title";

/**
 * Validates and runs the Lesson Title AI Assistant request for
 * `POST /api/v1/ai/assist` (`field: "lessonTitle"`, ANA-116). Unlike every
 * Module-level `field` this endpoint also serves, this never loads a Module
 * server-side -- the owning Module's context (`moduleTitle`/
 * `moduleDescription`/`moduleContent`) is always trusted directly from the
 * request body, the same way a Book's own fields are trusted for Book-level
 * AI Assistance (ANA-100): the Edit Module modal may still hold unsaved
 * Module edits that a server-side reload by id would silently discard.
 * `text` (the current title) may be empty: the Module context alone is the
 * required context a title can be drafted from even before this Lesson has
 * one.
 */
export async function suggestLessonTitleService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.text !== "string") {
    return fail("invalid-input", "`text` must be a string.");
  }

  if (typeof body.moduleTitle !== "string") {
    return fail("invalid-input", "`moduleTitle` must be a string.");
  }

  if (typeof body.moduleDescription !== "string") {
    return fail("invalid-input", "`moduleDescription` must be a string.");
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

  try {
    const text = await suggestLessonTitle(
      body.text,
      {
        moduleTitle: body.moduleTitle,
        moduleDescription: body.moduleDescription,
        moduleContent: body.moduleContent,
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
