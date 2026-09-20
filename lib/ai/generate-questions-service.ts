import "server-only";

import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import {
  generateQuestions,
  type GeneratedQuestion,
} from "./generate-questions";
import { AiTaskError } from "./run-ai-task";

export const MIN_GENERATED_QUESTION_COUNT = 1;
export const MAX_GENERATED_QUESTION_COUNT = 20;

/**
 * Validates and runs the Generate Questions request for
 * `POST /api/v1/ai/generate-questions` (ANA-131). Unlike the other
 * `/api/v1/ai/*` routes, this never loads a Book/Module/Lesson server-side --
 * the supplied `sourceText` (the passage to generate from) is the entire
 * context, exactly as the question editor's Generate modal collects it.
 */
export async function generateQuestionsService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ questions: GeneratedQuestion[] }>> {
  if (
    typeof body.sourceText !== "string" ||
    body.sourceText.trim().length === 0
  ) {
    return fail("invalid-input", "`sourceText` must be a non-empty string.");
  }

  if (
    typeof body.count !== "number" ||
    !Number.isInteger(body.count) ||
    body.count < MIN_GENERATED_QUESTION_COUNT ||
    body.count > MAX_GENERATED_QUESTION_COUNT
  ) {
    return fail(
      "invalid-input",
      `\`count\` must be an integer between ${MIN_GENERATED_QUESTION_COUNT} and ${MAX_GENERATED_QUESTION_COUNT}.`,
    );
  }

  const additionalInstructions =
    typeof body.additionalInstructions === "string"
      ? body.additionalInstructions.trim() || undefined
      : undefined;

  try {
    const questions = await generateQuestions(
      body.sourceText,
      body.count,
      additionalInstructions,
    );

    return ok({ questions });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail(
        "upstream-error",
        "Question generation failed. Please try again.",
      );
    }

    throw error;
  }
}
