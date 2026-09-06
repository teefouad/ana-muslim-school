import "server-only";

import { Mistral } from "@mistralai/mistralai";

let cachedClient: Mistral | undefined;

/**
 * Lazily constructs the Mistral client on first use rather than at module
 * load, for the same reason as `getAdminAuth` in lib/firebase/admin.ts --
 * `next build` statically evaluates route modules to collect page data, so
 * an eager client construction here would fail the production build in any
 * environment without `MISTRAL_API_KEY` configured (e.g. CI) even though
 * the OCR route only needs the key at request time.
 */
export function getMistralClient(): Mistral {
  if (!cachedClient) {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      throw new Error("Missing Mistral credentials. Set MISTRAL_API_KEY.");
    }

    cachedClient = new Mistral({ apiKey });
  }

  return cachedClient;
}
