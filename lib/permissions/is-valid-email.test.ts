import { describe, expect, it } from "vitest";

import { isValidEmail } from "./is-valid-email";

describe("isValidEmail", () => {
  it("accepts a normal email address", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejects a string without an @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects a string without a domain extension", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects an email containing whitespace", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
  });
});
