"use client";

import { useId } from "react";
import { Languages } from "lucide-react";
import { Button, Group, Stack, Text, Textarea } from "@mantine/core";

import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { LanguageOption } from "@/components/ui/translatable-value";
import { useActiveLanguage } from "@/components/ui/use-active-language";
import {
  applyParsedQuestionText,
  type QuestionFieldEntry,
} from "./question-fields";
import { parseQuestionText } from "./question-text-format";
import { useTranslateQuestion } from "./use-translate-question";

const LANGUAGES: readonly LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const PLACEHOLDER = `What is ...?

Explanation of the answer.

[ ] First choice
[x] Correct choice
[ ] Third choice`;

export interface QuestionTextEditorProps {
  question: QuestionFieldEntry;
  onChange: (question: QuestionFieldEntry) => void;
  /** Mirrors `useTranslateQuestion`'s own `onBusyChange` -- reported up so
   * the Questions list (questions-editor.tsx) can aggregate every card's
   * translate state into one flag the Lesson editor gates Save on. */
  onTranslatingChange?: (translating: boolean) => void;
}

// One Question's structured-text editor (ANA-119, matching the old admin's
// authoring format exactly) -- a single language-aware textarea per
// Question, parsed live into the same text/explanation/choices shape
// separate fields used to produce (see question-text-format.ts/
// question-fields.ts's applyParsedQuestionText) -- the persisted Question
// model never changes, only how it's authored.
export function QuestionTextEditor({
  question,
  onChange,
  onTranslatingChange,
}: QuestionTextEditorProps) {
  const textareaId = useId();
  const { activeSlug, setActiveSlug, isFilled } = useActiveLanguage(
    LANGUAGES,
    question.rawText,
  );
  const lang = (activeSlug ?? "ar") as "ar" | "en";

  const rawValue = question.rawText[lang] ?? "";
  const parseResult = parseQuestionText(rawValue);

  const translate = useTranslateQuestion({
    question,
    onTranslated: onChange,
    onBusyChange: onTranslatingChange,
  });

  // A translation in flight applies its result onto the `question` it read
  // at the start of the request -- an edit made while the request is in
  // flight would otherwise be silently overwritten once it lands, the same
  // failure mode FormField's own Translate with AI action guards against.
  const editingDisabled = translate.translating;

  function handleChange(newRaw: string) {
    const updatedRawText = { ...question.rawText, [lang]: newRaw };
    const parsed = parseQuestionText(newRaw);

    if (parsed.ok) {
      onChange(
        applyParsedQuestionText(
          { ...question, rawText: updatedRawText },
          lang,
          parsed.value,
        ),
      );
      return;
    }

    // Invalid input is never discarded, normalized, or replaced -- only
    // the raw buffer advances; text/explanation/choices stay exactly as
    // they were until the admin fixes it.
    onChange({ ...question, rawText: updatedRawText });
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Text component="label" htmlFor={textareaId} size="sm" fw={500}>
          Question
        </Text>
        <Group gap="sm">
          <Button
            type="button"
            variant="light"
            size="xs"
            radius="xl"
            disabled={translate.translating || !translate.canTranslate}
            loading={translate.translating}
            title={
              !translate.canTranslate && !translate.translating
                ? "Add valid Arabic question text first."
                : undefined
            }
            leftSection={<Languages size={14} aria-hidden="true" />}
            onClick={translate.translate}
          >
            Translate
          </Button>
          <LanguageSwitcher
            languages={LANGUAGES}
            value={lang}
            onChange={setActiveSlug}
            isFilled={isFilled}
          />
        </Group>
      </Group>

      <Textarea
        id={textareaId}
        dir={lang === "ar" ? "rtl" : "ltr"}
        rows={7}
        autosize
        minRows={7}
        value={rawValue}
        onChange={(event) => handleChange(event.currentTarget.value)}
        disabled={editingDisabled}
        placeholder={PLACEHOLDER}
        error={parseResult.ok ? undefined : parseResult.error}
      />

      {translate.error && (
        <Text role="alert" size="xs" c="red">
          {translate.error}
        </Text>
      )}
    </Stack>
  );
}
