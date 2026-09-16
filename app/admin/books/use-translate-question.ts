"use client";

import { useState } from "react";

import { translateArabicToEnglish } from "./import-source/translate-client";
import type { QuestionFieldEntry } from "./question-fields";
import { serializeQuestionText } from "./question-text-format";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export interface UseTranslateQuestionOptions {
  question: QuestionFieldEntry;
  onTranslated: (question: QuestionFieldEntry) => void;
  /** Mirrors FormField's own `onBusyChange` (form-field.tsx) -- fired
   * directly around the request, never via an effect, so the caller (the
   * Lesson editor) can gate Save while a translation is unresolved without
   * ever feeding this back into this field's own `disabled` (ANA-119
   * requirement: "Save must not run while a Question translation request
   * is unresolved"). */
  onBusyChange?: (busy: boolean) => void;
}

export interface UseTranslateQuestionResult {
  translating: boolean;
  error: string | null;
  /** Disabled the same way FormField's own Translate with AI action is --
   * there's nothing to translate from an empty Arabic question text. */
  canTranslate: boolean;
  translate: () => void;
}

// Translates a Question's Arabic text/explanation/choice text into English
// (ANA-119's Translate action, matching the old admin's Question editor) --
// one `POST /api/v1/ai/translate` call per string field via the existing
// plain, context-free `translateArabicToEnglish` boundary (the same one
// Lesson Title/Description already use, see lesson-form.tsx), run in
// parallel. Each choice's `isCorrect` flag is never sent to or read from
// the AI -- only its `text.ar` goes over the wire, and the result is
// written back onto that same choice's `text.en`, so translating can never
// change which choices are marked correct.
export function useTranslateQuestion({
  question,
  onTranslated,
  onBusyChange,
}: UseTranslateQuestionOptions): UseTranslateQuestionResult {
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canTranslate = Boolean(question.text.ar?.trim());

  async function runTranslate() {
    if (!canTranslate || translating) {
      return;
    }

    setError(null);
    setTranslating(true);
    onBusyChange?.(true);

    try {
      const explanationAr = question.explanation.ar?.trim();
      const [text, explanation, ...choiceTexts] = await Promise.all([
        translateArabicToEnglish(question.text.ar ?? ""),
        explanationAr
          ? translateArabicToEnglish(explanationAr)
          : Promise.resolve(question.explanation.en ?? ""),
        ...question.choices.map((choice) => {
          const choiceAr = choice.text.ar?.trim();
          return choiceAr
            ? translateArabicToEnglish(choiceAr)
            : Promise.resolve(choice.text.en ?? "");
        }),
      ]);

      const choices = question.choices.map((choice, index) => ({
        ...choice,
        text: { ...choice.text, en: choiceTexts[index] },
      }));

      onTranslated({
        ...question,
        text: { ...question.text, en: text },
        explanation: { ...question.explanation, en: explanation },
        choices,
        rawText: {
          ...question.rawText,
          en: serializeQuestionText({
            text,
            explanation,
            choices: choices.map((choice) => ({
              text: choice.text.en ?? "",
              isCorrect: choice.isCorrect,
            })),
          }),
        },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTranslating(false);
      onBusyChange?.(false);
    }
  }

  return {
    translating,
    error,
    canTranslate,
    translate: () => void runTranslate(),
  };
}
