"use client";

import { type ReactNode, useId } from "react";
import { Group, Stack, Text, TextInput } from "@mantine/core";

import { LanguageSwitcher } from "./language-switcher";
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
      <Group
        pos="relative"
        mt={14}
        justify="space-between"
        gap="sm"
        wrap="nowrap"
      >
        <Text component="label" htmlFor={fieldId} size="sm" fw={500}>
          {label}
        </Text>
        <Group
          gap="xs"
          wrap="nowrap"
          style={{
            position: "absolute",
            top: -15,
            right: 0,
          }}
        >
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
