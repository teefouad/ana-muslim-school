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

type TranslatableModuleField = "title" | "description" | "content";

export interface TranslateModuleFieldInput {
  bookId: string;
  field: TranslatableModuleField;
  text: string;
  additionalInstructions?: string;
  /** This Module's own Arabic sibling fields, when known (ANA-98/ANA-99) --
   * whichever of these aren't the field being translated, supplied as
   * orientation context so the translation preserves the meaning
   * appropriate to this Module rather than translating an isolated string. */
  moduleTitle?: string;
  moduleDescription?: string;
  moduleContent?: string;
}

/** Translates one Module field (Title/Description/Content) from Arabic to
 * English via `POST /api/v1/ai/translate` (`field` set, ANA-98) -- unlike
 * `translateArabicToEnglish`, the server loads the owning Book fresh from
 * `bookId` and uses it, plus whichever sibling Module fields the caller
 * supplies, as orientation context. Returns only the translated text --
 * callers apply it to their own draft. */
export async function translateModuleField({
  bookId,
  field,
  text,
  additionalInstructions,
  moduleTitle,
  moduleDescription,
  moduleContent,
}: TranslateModuleFieldInput): Promise<string> {
  const response = await fetch("/api/v1/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookId,
      field,
      text,
      additionalInstructions,
      moduleTitle,
      moduleDescription,
      moduleContent,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: { text: string } };

  return data.text;
}
