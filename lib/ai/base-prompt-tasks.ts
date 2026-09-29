/** Every AI action that sends a base prompt (ANA-134). Client-safe -- no
 * prompt text lives here, only the keys the UI passes to
 * `GET /api/v1/ai/base-prompt` to fetch that action's default prompt. */
export const AI_PROMPT_TASKS = [
  "assist.content",
  "assist.title",
  "assist.description",
  "assist.bookDescription",
  "assist.bookLongDescription",
  "assist.lessonTitle",
  "assist.lessonDescription",
  "translate.plain",
  "translate.module",
  "generateQuestions",
] as const;

export type AiPromptTask = (typeof AI_PROMPT_TASKS)[number];

export function isAiPromptTask(value: unknown): value is AiPromptTask {
  return AI_PROMPT_TASKS.includes(value as AiPromptTask);
}
