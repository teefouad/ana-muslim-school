"use client";

import { type ReactNode, useId } from "react";
import { Stack, TextInput } from "@mantine/core";

import { TranslatableFieldHeader } from "./translatable-field-header";
import type { LanguageOption, TranslatedValue } from "./translatable-value";
import { useActiveLanguage } from "./use-active-language";

export interface TranslatableTextInputProps {
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

// A single-line field backed by one value per language, with a language
// switcher for choosing which one is showing. Callers own `value`/`onChange`
// and this component carries no translation API/business logic of its own --
// see TranslatableTextArea for the Markdown-backed multiline counterpart.
export function TranslatableTextInput({
  label,
  languages,
  value,
  onChange,
  placeholder,
  disabled,
  actions,
}: TranslatableTextInputProps) {
  const fieldId = useId();
  const { activeSlug, setActiveSlug, isFilled } = useActiveLanguage(
    languages,
    value,
  );

  if (!activeSlug) return null;

  return (
    <Stack gap={4}>
      <TranslatableFieldHeader
        label={label}
        htmlFor={fieldId}
        languages={languages}
        activeSlug={activeSlug}
        onActiveSlugChange={setActiveSlug}
        isFilled={isFilled}
        disabled={disabled}
        actions={actions?.(activeSlug)}
      />
      <TextInput
        id={fieldId}
        dir="auto"
        value={value[activeSlug] ?? ""}
        onChange={(event) =>
          onChange({ ...value, [activeSlug]: event.currentTarget.value })
        }
        placeholder={placeholder}
        disabled={disabled}
      />
    </Stack>
  );
}
