import { describe, expect, it } from "vitest";

import { isValidDocId } from "./is-valid-doc-id";

describe("isValidDocId", () => {
  it("accepts a normal id", () => {
    expect(isValidDocId("doc-1")).toBe(true);
  });

  it("rejects an empty id", () => {
    expect(isValidDocId("")).toBe(false);
  });

  it("rejects an id containing a slash (a decoded %2F that would escape the collection)", () => {
    expect(isValidDocId("a/b")).toBe(false);
  });
});
