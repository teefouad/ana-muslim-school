import { useState } from "react";

import type { LanguageOption, TranslatedValue } from "./translatable-value";

export interface ActiveLanguage {
  /** The slug currently showing, or `undefined` if `languages` is empty. */
  activeSlug: string | undefined;
  setActiveSlug: (slug: string) => void;
  isFilled: (slug: string) => boolean;
}

// Shared active-language logic for TranslatableTextInput/TranslatableTextArea.
// Arabic is the school admin's primary language -- it wins as the default
// active language whenever it's among the caller's languages, regardless of
// the order they're listed in, so no individual field needs to reorder its
// own `languages` prop to get this. The first provided language is the
// default when Arabic isn't offered at all.
export function useActiveLanguage(
  languages: readonly LanguageOption[],
  value: TranslatedValue,
): ActiveLanguage {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const defaultSlug =
    languages.find((language) => language.slug === "ar")?.slug ??
    languages[0]?.slug;

  const activeSlug = languages.some(
    (language) => language.slug === selectedSlug,
  )
    ? (selectedSlug as string)
    : defaultSlug;

  return {
    activeSlug,
    setActiveSlug: setSelectedSlug,
    isFilled: (slug) => Boolean(value[slug]?.trim()),
  };
}
