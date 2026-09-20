import { readErrorMessage } from "./fetch-json";

export interface GeneratedQuestionChoice {
  text: string;
  isCorrect: boolean;
}

export interface GeneratedQuestion {
  text: string;
  explanation: string;
  choices: GeneratedQuestionChoice[];
}

export interface GenerateQuestionsInput {
  sourceText: string;
  additionalInstructions?: string;
  count: number;
}

/** Generates Questions from a source passage via
 * `POST /api/v1/ai/generate-questions` (ANA-131) -- the server-only AI
 * service is never imported into a Client Component; this is the narrow
 * REST boundary for it. Returns the generated questions as-is; the caller
 * (questions-editor.tsx) turns each into its own local Question draft. */
export async function generateQuestions({
  sourceText,
  additionalInstructions,
  count,
}: GenerateQuestionsInput): Promise<GeneratedQuestion[]> {
  const response = await fetch("/api/v1/ai/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText, additionalInstructions, count }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as {
    data: { questions: GeneratedQuestion[] };
  };

  return data.questions;
}
