"use client";

import {
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Group, Stack, Text } from "@mantine/core";

import { LanguageSwitcher } from "./language-switcher";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";
import type { LanguageOption, TranslatedValue } from "./translatable-value";
import { useActiveLanguage } from "./use-active-language";

// Deliberately narrower than MarkdownEditorHandle: callers of
// TranslatableTextArea control content through the `value` prop, so
// `setMarkdown` stays an internal implementation detail of how this
// component keeps the mounted editor in sync (see the effect below).
export interface TranslatableTextAreaHandle {
  getSelectedText: () => string;
  getSelectedMarkdown: () => string;
}

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
  const activeValue = activeSlug ? (value[activeSlug] ?? "") : "";

  // Tracks the language/value pair the mounted editor is currently showing,
  // so an external change to value[activeSlug] (a form reset, a caller-
  // provided Translate/Suggest action, loading a different record while the
  // same language stays active, etc.) can be told apart from the editor's
  // own onChange round-tripping back through the parent's state -- only the
  // former should push a fresh value into the editor via setMarkdown();
  // doing that unconditionally would reset the cursor/selection on every
  // keystroke. A language switch already remounts MarkdownEditor (keyed on
  // activeSlug) with the right initial value, so that case only needs to
  // update the tracked snapshot, not call setMarkdown.
  //
  // This has to be React state, not a plain ref written from inside the
  // onChange handler: the editor's onChange and the parent's own state
  // update both happen synchronously in the same handler, but a ref write
  // there is visible to an in-flight effect immediately, ahead of the
  // matching `value` prop update reaching this component's own render.
  // That gap made an effect reading a ref see `value`/`shown` disagree for
  // an instant and misfire setMarkdown -- with both sides as state set in
  // the same handler, React batches them into one commit, so this effect
  // only ever compares numbers that updated together.
  const [shown, setShown] = useState({ slug: activeSlug, value: activeValue });

  useEffect(() => {
    if (shown.slug !== activeSlug) {
      setShown({ slug: activeSlug, value: activeValue });
      return;
    }
    if (shown.value !== activeValue) {
      editorRef.current?.setMarkdown(activeValue);
      setShown({ slug: activeSlug, value: activeValue });
    }
  }, [activeSlug, activeValue, shown]);

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
        markdown={activeValue}
        onChange={(markdown) => {
          // Batched into the same commit as the parent's own state update
          // below (see `shown` above), so the effect never sees them
          // disagree for this edit and bounces it back via setMarkdown.
          setShown({ slug: activeSlug, value: markdown });
          onChange({ ...value, [activeSlug]: markdown });
        }}
        placeholder={placeholder}
        disabled={disabled}
        dir={activeSlug === "ar" ? "rtl" : "ltr"}
      />
    </Stack>
  );
});
