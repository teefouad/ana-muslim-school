import { readErrorMessage } from "../fetch-json";

/** Translates an Arabic Learning Material draft to English via
 * `POST /api/v1/ai/translate` (ANA-77) -- the server-only AI service (see
 * ANA-74) is never imported into a Client Component; this is the narrow
 * REST boundary for it. Returns only the translated text -- callers apply
 * it to their own `material.en` draft themselves. */
export async function translateArabicToEnglish(text: string): Promise<string> {
  const response = await fetch("/api/v1/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: { text: string } };

  return data.text;
}
