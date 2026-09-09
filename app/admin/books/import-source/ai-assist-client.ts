import { readErrorMessage } from "../fetch-json";

export type AiAssistLanguage = "ar" | "en";

export interface AssistLearningMaterialInput {
  bookId: string;
  text: string;
  language: AiAssistLanguage;
  additionalInstructions?: string;
}

/** Runs the Module AI Assistant on a Learning Material draft via
 * `POST /api/v1/ai/assist` (ANA-85) -- the server-only AI service (see
 * ANA-74/ANA-85) is never imported into a Client Component; this is the
 * narrow REST boundary for it. The client sends only `bookId` (never Book
 * content itself, which the server always loads fresh). Returns only the
 * refined text -- callers apply it to their own Learning Material draft
 * themselves. */
export async function assistLearningMaterial({
  bookId,
  text,
  language,
  additionalInstructions,
}: AssistLearningMaterialInput): Promise<string> {
  const response = await fetch("/api/v1/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, text, language, additionalInstructions }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: { text: string } };

  return data.text;
}
