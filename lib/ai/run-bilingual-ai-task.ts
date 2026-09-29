import "server-only";

import { AiTaskError, runAiTask, type RunAiTaskInput } from "./run-ai-task";

/** One AI Assistance result in both languages (ANA-135). */
export type BilingualText = { ar: string; en: string };

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    ar: { type: "string" },
    en: { type: "string" },
  },
  required: ["ar", "en"],
};

/**
 * Prompt rules shared by every bilingual AI Assistance action (ANA-135).
 * Each action's own base prompt describes the task and its rules once;
 * this block says how those rules apply to the two-language output, so the
 * English side is never an unconstrained translation of the Arabic side.
 */
export const BILINGUAL_OUTPUT_RULES = `
- Return the result in BOTH languages: Arabic in the "ar" field and English
  in the "en" field of the structured response. Write each one as the
  result the task above describes -- never leave either empty.
- Every rule above and every additional instruction from the editor --
  length or word limits, format, structure, tone, required or forbidden
  content, Markdown or plain text -- applies to the Arabic result AND to
  the English result, each on its own. Count words, characters, sentences,
  and items separately in each language, and keep each language within its
  own limits. An English text that is longer than its limit is a failure
  even when the Arabic text is within it, and the reverse.
- Do not produce the English result by translating the Arabic result
  word for word. Write it so it satisfies the same constraints itself
  (shortening or rewording where English needs it) while conveying the same
  meaning as closely as those constraints allow. The two results must stay
  consistent in meaning and must not add facts that the other lacks.
- Handle Islamic terminology and proper nouns consistently in English (for
  example: Salah, Zakat, Surah).
`.trim();

function isBilingualText(value: unknown): value is BilingualText {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  return (
    typeof v.ar === "string" &&
    v.ar.trim().length > 0 &&
    typeof v.en === "string" &&
    v.en.trim().length > 0
  );
}

/**
 * Runs a bilingual AI task through the shared executor in Structured Outputs
 * mode (ANA-135), so both languages come from the same call -- and are each
 * subject to the task's constraints -- instead of generating Arabic and
 * translating it afterwards. `basePrompt` must describe the task once and
 * end its output rules with `BILINGUAL_OUTPUT_RULES`. Throws `AiTaskError`
 * when the response isn't valid JSON with a non-empty `ar` and `en`.
 */
export async function runBilingualAiTask(
  input: Omit<RunAiTaskInput, "responseFormat">,
): Promise<BilingualText> {
  const raw = await runAiTask({
    ...input,
    responseFormat: { name: "bilingual_text", schema: RESPONSE_SCHEMA },
  });

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new AiTaskError("The AI response was not valid JSON.", {
      cause: error,
    });
  }

  if (!isBilingualText(parsed)) {
    throw new AiTaskError(
      "The AI response did not include both Arabic and English text.",
    );
  }

  return { ar: parsed.ar.trim(), en: parsed.en.trim() };
}

/**
 * Formats one field's Arabic/English values as prompt input lines, for the
 * Book actions whose caller supplies both languages (ANA-135). Returns
 * `placeholder` when neither value has content.
 */
export function formatBilingualContext(
  value: BilingualText,
  placeholder: string,
): string {
  const ar = value.ar.trim();
  const en = value.en.trim();
  const lines = [
    ...(ar ? [`Arabic: ${ar}`] : []),
    ...(en ? [`English: ${en}`] : []),
  ];

  return lines.length > 0 ? lines.join("\n") : placeholder;
}
