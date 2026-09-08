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
  /** Optional editor/user guidance, appended after `input` -- never replaces `basePrompt`. */
  additionalInstructions?: string;
  maxOutputTokens?: number;
};

function composeInput(input: string, additionalInstructions?: string): string {
  const trimmedInstructions = additionalInstructions?.trim();

  if (!trimmedInstructions) {
    return input;
  }

  return `${input}\n\n---\nAdditional instructions from the editor:\n${trimmedInstructions}`;
}

/**
 * Runs a single server-side AI text task against the shared OpenAI client.
 * `basePrompt` is sent as the Responses API `instructions` (model/system-
 * level task instructions, kept separate from `input` on the wire) while
 * `input` -- optionally followed by `additionalInstructions` -- is sent as
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
      instructions: basePrompt,
      input: composeInput(input, additionalInstructions),
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
