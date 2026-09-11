"use client";

import type { ReactNode } from "react";
import { Group, Text } from "@mantine/core";

import { LanguageSwitcher } from "./language-switcher";
import type { LanguageOption } from "./translatable-value";

export interface TranslatableFieldHeaderProps {
  label: string;
  /** Associates the label with a native input via `htmlFor` (e.g. a
   * single-line input's own id). Omit when the field body has no single
   * focusable native element to associate with (e.g. a Markdown editor). */
  htmlFor?: string;
  languages: readonly LanguageOption[];
  activeSlug: string;
  onActiveSlugChange: (slug: string) => void;
  isFilled: (slug: string) => boolean;
  disabled?: boolean;
  /** Extra controls (e.g. an AI action) rendered between the label and the
   * language switcher. */
  actions?: ReactNode;
}

// The label + caller-provided actions + language switcher row shared by
// every translatable field. Extracted from TranslatableTextInput and
// TranslatableTextArea (ANA-96), which previously duplicated this exact
// layout byte-for-byte -- each field now only owns its own input/editor
// body underneath this header.
export function TranslatableFieldHeader({
  label,
  htmlFor,
  languages,
  activeSlug,
  onActiveSlugChange,
  isFilled,
  disabled,
  actions,
}: TranslatableFieldHeaderProps) {
  return (
    <Group
      pos="relative"
      mt={14}
      justify="space-between"
      gap="sm"
      wrap="nowrap"
    >
      <Text
        component={htmlFor ? "label" : "p"}
        htmlFor={htmlFor}
        size="sm"
        fw={500}
      >
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
        {actions}
        <LanguageSwitcher
          languages={languages}
          value={activeSlug}
          onChange={onActiveSlugChange}
          isFilled={isFilled}
          disabled={disabled}
        />
      </Group>
    </Group>
  );
}
