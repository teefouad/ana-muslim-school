"use client";

import { Box, Group, SegmentedControl } from "@mantine/core";

import type { LanguageOption } from "./translatable-value";

export interface LanguageSwitcherProps {
  languages: readonly LanguageOption[];
  value: string;
  onChange: (slug: string) => void;
  /** When provided, renders a small dot next to each language reflecting
   * whether it has content yet (e.g. a translatable field with/without a
   * value for that language). Omit to hide the indicator entirely. */
  isFilled?: (slug: string) => boolean;
  disabled?: boolean;
}

// A pill-style tab switcher for choosing among a small set of languages --
// e.g. which language a translatable field is currently showing. Reusable by
// any future multilingual field; carries no translation logic of its own.
export function LanguageSwitcher({
  languages,
  value,
  onChange,
  isFilled,
  disabled,
}: LanguageSwitcherProps) {
  return (
    <SegmentedControl
      aria-label="Language"
      size="xs"
      value={value}
      onChange={onChange}
      disabled={disabled}
      data={languages.map((language) => ({
        value: language.slug,
        label: (
          <Group gap={6} wrap="nowrap" justify="center">
            <span>{language.label}</span>
            {isFilled && (
              <Box
                component="span"
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  flexShrink: 0,
                  borderRadius: "50%",
                  backgroundColor: isFilled(language.slug)
                    ? "var(--mantine-primary-color-filled)"
                    : "var(--mantine-color-default-border)",
                }}
              />
            )}
          </Group>
        ),
      }))}
    />
  );
}
