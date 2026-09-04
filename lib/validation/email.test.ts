import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  someone@example.com  ")).toBe(
      "someone@example.com",
    );
  });

  it("lowercases the email", () => {
    expect(normalizeEmail("Someone@Example.COM")).toBe("someone@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("someone@example.com")).toBe(true);
  });

  it("rejects emails missing an @", () => {
    expect(isValidEmail("someone.example.com")).toBe(false);
  });

  it("rejects emails missing a domain", () => {
    expect(isValidEmail("someone@example")).toBe(false);
  });

  it("rejects emails with whitespace", () => {
    expect(isValidEmail("some one@example.com")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});
