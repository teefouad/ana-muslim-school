"use client";

import { type ReactNode, forwardRef, useImperativeHandle, useRef } from "react";
import { Group, Stack, Text } from "@mantine/core";

import { LanguageSwitcher } from "./language-switcher";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";
import type { LanguageOption, TranslatedValue } from "./translatable-value";
import { useActiveLanguage } from "./use-active-language";

export type TranslatableTextAreaHandle = MarkdownEditorHandle;

export interface TranslatableTextAreaProps {
  label: string;
  languages: readonly LanguageOption[];
  value: TranslatedValue;
  onChange: (value: TranslatedValue) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Extra controls (e.g. a future AI "Translate" action) rendered between
   * the label and the language switcher. Receives the slug of the language
   * currently showing. */
  actions?: (activeSlug: string) => ReactNode;
}

// Markdown-backed multiline counterpart to TranslatableTextInput, using
// MDXEditor (via the MarkdownEditor wrapper) for live-formatted editing.
// MDXEditor's `markdown` prop only seeds the editor's *initial* content, so
// rather than pushing every value through it, switching the active language
// remounts MarkdownEditor keyed on the slug -- each language gets its own
// editor instance/undo history, and there's no risk of one language's
// content leaking into another (see markdown-editor.tsx).
export const TranslatableTextArea = forwardRef<
  TranslatableTextAreaHandle,
  TranslatableTextAreaProps
>(function TranslatableTextArea(
  { label, languages, value, onChange, placeholder, disabled, actions },
  ref,
) {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const { activeSlug, setActiveSlug, isFilled } = useActiveLanguage(
    languages,
    value,
  );

  useImperativeHandle(ref, () => ({
    getSelectedText: () => editorRef.current?.getSelectedText() ?? "",
    getSelectedMarkdown: () => editorRef.current?.getSelectedMarkdown() ?? "",
  }));

  if (!activeSlug) return null;

  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Group gap="xs" wrap="nowrap">
          {actions?.(activeSlug)}
          <LanguageSwitcher
            languages={languages}
            value={activeSlug}
            onChange={setActiveSlug}
            isFilled={isFilled}
            disabled={disabled}
          />
        </Group>
      </Group>
      <MarkdownEditor
        key={activeSlug}
        ref={editorRef}
        markdown={value[activeSlug] ?? ""}
        onChange={(markdown) => onChange({ ...value, [activeSlug]: markdown })}
        placeholder={placeholder}
        disabled={disabled}
        dir={activeSlug === "ar" ? "rtl" : "ltr"}
      />
    </Stack>
  );
});
