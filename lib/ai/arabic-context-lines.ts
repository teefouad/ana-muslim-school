import "server-only";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";

/**
 * Extracts the Arabic value from a bilingual field (ANA-99) -- the single
 * shared place every lib/ai task reads `.ar` off a `TranslatableString`
 * before building an AI prompt, so `.en` is never accidentally serialized
 * into one. Non-translation AI generation/assistance operates on Arabic
 * content only; see each base prompt's own "Return ... Arabic only" rule.
 */
function arabicValue(value: TranslatableString): string {
  return value.ar.trim();
}

/**
 * Formats one bilingual field as a single "Label: ..." context line, Arabic
 * only, omitting it entirely when blank rather than including an empty
 * line. Shared by every lib/ai task that composes a Book/Module context
 * block (refine-learning-material.ts, suggest-module-title.ts,
 * suggest-module-description.ts, translate-module-field.ts -- ANA-99)
 * so that no context block ever serializes a field's English value into an
 * AI prompt, even when translation context is also involved.
 */
export function arabicContextLine(
  label: string,
  value: TranslatableString,
): string[] {
  const ar = arabicValue(value);

  return ar ? [`${label}: ${ar}`] : [];
}
