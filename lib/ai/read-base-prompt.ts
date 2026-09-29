import "server-only";

/** Upper bound on an editor-supplied base prompt (ANA-134) -- the shipped
 * prompts are ~2-4k characters; this leaves generous room to edit while
 * keeping a request from smuggling in an arbitrarily large payload. */
export const MAX_BASE_PROMPT_LENGTH = 20000;

/**
 * Reads the optional `basePrompt` request field (ANA-134). Every AI action
 * shows its base prompt to the admin in an editable field before sending
 * and submits the final value here, so the edited prompt -- not the
 * server's default -- is what reaches the model. `undefined` (omitted)
 * keeps the helper's own default prompt; a supplied value must be a
 * non-blank string within `MAX_BASE_PROMPT_LENGTH`. Callers are already
 * gated by `books.update`, so this is admin-authored instruction text, not
 * untrusted end-user input.
 */
export function readBasePrompt(
  value: unknown,
): { ok: true; value?: string } | { ok: false; message: string } {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, message: "`basePrompt` must be a non-empty string." };
  }

  if (value.length > MAX_BASE_PROMPT_LENGTH) {
    return {
      ok: false,
      message: `\`basePrompt\` must be at most ${MAX_BASE_PROMPT_LENGTH} characters.`,
    };
  }

  return { ok: true, value };
}
