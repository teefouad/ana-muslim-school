import { describe, expect, it } from "vitest";

import { isValidReorder } from "./validate-reorder";

describe("isValidReorder", () => {
  it("accepts a permutation of the current ids", () => {
    expect(isValidReorder(["b", "a", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("accepts the identity order", () => {
    expect(isValidReorder(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("rejects a different length (silent attach/detach)", () => {
    expect(isValidReorder(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isValidReorder(["a"], ["a", "b"])).toBe(false);
  });

  it("rejects an unknown id", () => {
    expect(isValidReorder(["a", "x"], ["a", "b"])).toBe(false);
  });

  it("rejects a duplicate id even if the set matches in size", () => {
    expect(isValidReorder(["a", "a"], ["a", "b"])).toBe(false);
  });

  it("accepts an empty reorder of an empty current order", () => {
    expect(isValidReorder([], [])).toBe(true);
  });
});
