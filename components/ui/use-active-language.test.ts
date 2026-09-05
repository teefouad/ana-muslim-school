import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";

import { useActiveLanguage } from "./use-active-language";

const AR_FIRST = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const EN_FIRST = [
  { slug: "en", label: "English" },
  { slug: "ar", label: "Arabic" },
];

test("defaults to Arabic regardless of the languages order", () => {
  const { result: arFirst } = renderHook(() => useActiveLanguage(AR_FIRST, {}));
  expect(arFirst.current.activeSlug).toBe("ar");

  const { result: enFirst } = renderHook(() => useActiveLanguage(EN_FIRST, {}));
  expect(enFirst.current.activeSlug).toBe("ar");
});

test("falls back to the first language when Arabic isn't offered", () => {
  const { result } = renderHook(() =>
    useActiveLanguage([{ slug: "en", label: "English" }], {}),
  );
  expect(result.current.activeSlug).toBe("en");
});

test("setActiveSlug switches the active language", () => {
  const { result } = renderHook(() => useActiveLanguage(EN_FIRST, {}));

  act(() => result.current.setActiveSlug("en"));

  expect(result.current.activeSlug).toBe("en");
});

test("isFilled reflects non-empty, non-whitespace-only values", () => {
  const { result } = renderHook(() =>
    useActiveLanguage(EN_FIRST, { ar: "عنوان", en: "   " }),
  );

  expect(result.current.isFilled("ar")).toBe(true);
  expect(result.current.isFilled("en")).toBe(false);
});
