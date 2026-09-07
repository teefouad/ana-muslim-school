import { describe, expect, it } from "vitest";

import { buildSourceContent } from "./build-source-content";

describe("buildSourceContent", () => {
  it("joins pages already in ascending order with a blank line between them", () => {
    expect(buildSourceContent({ 1: "First page", 2: "Second page" })).toBe(
      "First page\n\nSecond page",
    );
  });

  it("orders pages ascending regardless of key insertion order", () => {
    expect(buildSourceContent({ 3: "Third", 1: "First", 2: "Second" })).toBe(
      "First\n\nSecond\n\nThird",
    );
  });

  it("returns a single page's text with no join when only one page exists", () => {
    expect(buildSourceContent({ 5: "Only page" })).toBe("Only page");
  });

  it("returns an empty string for no pages", () => {
    expect(buildSourceContent({})).toBe("");
  });
});
