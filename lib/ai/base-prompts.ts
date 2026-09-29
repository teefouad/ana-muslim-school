import "server-only";

import type { AiPromptTask } from "./base-prompt-tasks";
import { BASE_PROMPT as GENERATE_QUESTIONS } from "./generate-questions";
import { BASE_PROMPT as REFINE_CONTENT } from "./refine-learning-material";
import { basePrompt as BOOK_DESCRIPTION } from "./suggest-book-description";
import { basePrompt as BOOK_LONG_DESCRIPTION } from "./suggest-book-long-description";
import { BASE_PROMPT as LESSON_DESCRIPTION } from "./suggest-lesson-description";
import { BASE_PROMPT as LESSON_TITLE } from "./suggest-lesson-title";
import { BASE_PROMPT as MODULE_DESCRIPTION } from "./suggest-module-description";
import { BASE_PROMPT as MODULE_TITLE } from "./suggest-module-title";
import { BASE_PROMPT as TRANSLATE_MODULE } from "./translate-module-field";
import { BASE_PROMPT as TRANSLATE_PLAIN } from "./translate-arabic-to-english";

/**
 * The default base prompt each AI action sends (ANA-134), so the UI can show
 * it -- editable -- before the request is made. Reads the same constants the
 * helpers themselves fall back to, so what the admin sees is exactly what is
 * sent when they leave it untouched. `language` only matters for the Book
 * description/long description prompts, which are language-parameterized.
 */
export function getBasePrompt(
  task: AiPromptTask,
  language: "ar" | "en" = "ar",
): string {
  switch (task) {
    case "assist.content":
      return REFINE_CONTENT;
    case "assist.title":
      return MODULE_TITLE;
    case "assist.description":
      return MODULE_DESCRIPTION;
    case "assist.bookDescription":
      return BOOK_DESCRIPTION(language);
    case "assist.bookLongDescription":
      return BOOK_LONG_DESCRIPTION(language);
    case "assist.lessonTitle":
      return LESSON_TITLE;
    case "assist.lessonDescription":
      return LESSON_DESCRIPTION;
    case "translate.plain":
      return TRANSLATE_PLAIN;
    case "translate.module":
      return TRANSLATE_MODULE;
    case "generateQuestions":
      return GENERATE_QUESTIONS;
  }
}
