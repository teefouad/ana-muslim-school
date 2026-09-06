import { describe, expect, it } from "vitest";

import { hasOnlyAllowedKeys } from "./has-only-allowed-keys";

describe("hasOnlyAllowedKeys", () => {
  it("accepts a body containing only allowed keys, including a subset", () => {
    expect(hasOnlyAllowedKeys({ a: 1 }, ["a", "b"])).toBe(true);
    expect(hasOnlyAllowedKeys({}, ["a", "b"])).toBe(true);
  });

  it("rejects a body containing an unknown key", () => {
    expect(hasOnlyAllowedKeys({ a: 1, id: "spoofed" }, ["a"])).toBe(false);
  });
});
