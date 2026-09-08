import "server-only";

import OpenAI from "openai";

/**
 * Text model shared by every AI task in this service, centralized here so
 * call sites never duplicate (and risk drifting) a model string.
 */
export const AI_MODEL = "gpt-5.6-terra";

let cachedClient: OpenAI | undefined;

/**
 * Lazily constructs the OpenAI client on first use rather than at module
 * load, for the same reason as `getMistralClient` in
 * lib/sources/mistral-client.ts -- `next build` statically evaluates route
 * modules to collect page data, so an eager client construction here would
 * fail the production build in any environment without `OPENAI_API_KEY`
 * configured (e.g. CI) even though AI tasks only need the key at request
 * time.
 */
export function getOpenAiClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("Missing OpenAI credentials. Set OPENAI_API_KEY.");
    }

    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}
