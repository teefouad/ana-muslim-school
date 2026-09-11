import "server-only";

import { AI_MODEL, getOpenAiClient } from "./ai-client";

/**
 * Thrown for any failure to produce a usable AI text result -- a provider
 * error, an incomplete/failed model response, or empty output. The message
 * is always a fixed, generic string; the underlying provider error (if any)
 * is attached as `cause` for server-side logging rather than being folded
 * into the message, so this never ends up echoing source/prompt content or
 * provider request details back out.
 */
export class AiTaskError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiTaskError";
  }
}

export type RunAiTaskInput = {
  /** The content to transform. Always treated as data, never as instructions. */
  input: string;
  /** Trusted server-side task instructions. Never sourced from a client request. */
  basePrompt: string;
  /** Trusted editor guidance (ANA-99) -- composed into the same `instructions`
   * channel as `basePrompt`, at equal priority, never appended underneath it
   * as ordinary `input` content. */
  additionalInstructions?: string;
  maxOutputTokens?: number;
};

/**
 * Composes `basePrompt` and `additionalInstructions` into one `instructions`
 * string (ANA-99) -- both are trusted, model-level task instructions, so
 * they belong in the same Responses API instruction channel at the same
 * priority. `additionalInstructions` is never folded into `input`: doing so
 * would demote it to ordinary data underneath `basePrompt`, exactly the
 * "lower priority" behavior ANA-99 requires removing.
 */
function composeInstructions(
  basePrompt: string,
  additionalInstructions?: string,
): string {
  const trimmedInstructions = additionalInstructions?.trim();

  if (!trimmedInstructions) {
    return basePrompt;
  }

  return `${basePrompt}\n\n---\nAdditional instructions from the editor -- equally authoritative task instructions; apply them fully wherever they don't conflict with a rule above:\n${trimmedInstructions}`;
}

/**
 * Runs a single server-side AI text task against the shared OpenAI client.
 * `basePrompt` and `additionalInstructions` are composed into the Responses
 * API `instructions` (the trusted, model/system-level channel, kept separate
 * from `input` on the wire -- ANA-99) while `input` is sent, unmodified, as
 * the content to transform.
 */
export async function runAiTask({
  input,
  basePrompt,
  additionalInstructions,
  maxOutputTokens,
}: RunAiTaskInput): Promise<string> {
  const client = getOpenAiClient();

  let response;

  try {
    response = await client.responses.create({
      model: AI_MODEL,
      instructions: composeInstructions(basePrompt, additionalInstructions),
      input,
      ...(maxOutputTokens != null
        ? { max_output_tokens: maxOutputTokens }
        : {}),
    });
  } catch (error) {
    throw new AiTaskError("The AI request failed.", { cause: error });
  }

  if (response.status !== "completed") {
    throw new AiTaskError(
      `The AI response was not completed (status: ${response.status}).`,
      { cause: response.error ?? response.incomplete_details ?? undefined },
    );
  }

  const text = response.output_text.trim();

  if (!text) {
    throw new AiTaskError("The AI response did not include any text.");
  }

  return text;
}
