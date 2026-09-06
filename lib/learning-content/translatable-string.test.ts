import { describe, expect, it } from "vitest";

import {
  isValidTranslatableString,
  parseTranslatableString,
} from "./translatable-string";

describe("isValidTranslatableString", () => {
  it("accepts a { ar, en } string pair, including empty strings", () => {
    expect(isValidTranslatableString({ ar: "", en: "" })).toBe(true);
    expect(isValidTranslatableString({ ar: "مرحبا", en: "Hello" })).toBe(true);
  });

  it("rejects a missing key, a non-string value, or a non-object", () => {
    expect(isValidTranslatableString({ ar: "x" })).toBe(false);
    expect(isValidTranslatableString({ ar: 1, en: "x" })).toBe(false);
    expect(isValidTranslatableString("not an object")).toBe(false);
    expect(isValidTranslatableString(null)).toBe(false);
  });
});

describe("parseTranslatableString", () => {
  it("parses a well-formed { ar, en } pair", () => {
    expect(parseTranslatableString({ ar: "أ", en: "a" })).toEqual({
      ar: "أ",
      en: "a",
    });
  });

  it("rejects extra keys so a caller can't smuggle unrelated fields through", () => {
    expect(parseTranslatableString({ ar: "أ", en: "a", fr: "a" })).toBeNull();
  });

  it("rejects a missing key or wrong-typed value", () => {
    expect(parseTranslatableString({ ar: "أ" })).toBeNull();
    expect(parseTranslatableString({ ar: 1, en: "a" })).toBeNull();
    expect(parseTranslatableString(null)).toBeNull();
    expect(parseTranslatableString("nope")).toBeNull();
  });
});
