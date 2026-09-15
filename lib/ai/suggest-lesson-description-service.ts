import "server-only";

import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
import { suggestLessonDescription } from "./suggest-lesson-description";

/**
 * Validates and runs the Lesson Description AI Assistant request for
 * `POST /api/v1/ai/assist` (`field: "lessonDescription"`, ANA-116) -- see
 * `suggestLessonTitleService` for why this never loads a Module server-side
 * either, trusting `moduleTitle`/`moduleDescription`/`moduleContent`
 * directly from the request body instead. `text` (the current description)
 * may be empty: the Module context alone is the required context a
 * description can be drafted from even before this Lesson has one.
 */
export async function suggestLessonDescriptionService(
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

  try {
    const text = await suggestLessonDescription(
      body.text,
      {
        moduleTitle: body.moduleTitle,
        moduleDescription: body.moduleDescription,
        moduleContent: body.moduleContent,
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
