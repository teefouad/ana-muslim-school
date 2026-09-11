import "server-only";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";

/**
 * Formats one bilingual field as up to two "Label (Arabic): ..." /
 * "Label (English): ..." lines for an AI prompt's context block, omitting
 * whichever language is blank rather than including an empty line. Shared
 * by every lib/ai task that composes a Book/Module context block
 * (refine-learning-material.ts, suggest-module-title.ts,
 * suggest-module-description.ts, translate-module-field.ts -- ANA-98) so
 * that formatting never drifts between them.
 */
export function translatableContextLines(
  label: string,
  value: TranslatableString,
): string[] {
  const lines: string[] = [];

  if (value.ar.trim()) {
    lines.push(`${label} (Arabic): ${value.ar.trim()}`);
  }

  if (value.en.trim()) {
    lines.push(`${label} (English): ${value.en.trim()}`);
  }

  return lines;
}
