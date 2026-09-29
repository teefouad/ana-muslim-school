import "server-only";

import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { readBasePrompt } from "./read-base-prompt";
import { AiTaskError } from "./run-ai-task";
import { translateArabicToEnglish } from "./translate-arabic-to-english";

/**
 * Validates and runs the Arabic -> English Module Learning Material
 * translation for `POST /api/v1/ai/translate` (ANA-77). This is the only
 * server boundary the client reaches for this action -- it calls the
 * specialized `translateArabicToEnglish()` helper only, never the generic
 * `runAiTask` executor, model choice, or arbitrary system instructions supplied by the
 * request. The base prompt may be overridden with the admin-edited one
 * (ANA-134, `basePrompt`).
 */
export async function translateArabicToEnglishService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return fail("invalid-input", "`text` must be a non-empty string.");
  }

  const basePrompt = readBasePrompt(body.basePrompt);

  if (!basePrompt.ok) {
    return fail("invalid-input", basePrompt.message);
  }

  try {
    const text = await translateArabicToEnglish(
      body.text,
      undefined,
      basePrompt.value,
    );

    return ok({ text });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail("upstream-error", "Translation failed. Please try again.");
    }

    throw error;
  }
}
