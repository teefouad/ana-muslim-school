import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  admin@example.com  ")).toBe("admin@example.com");
  });

  it("lowercases the email", () => {
    expect(normalizeEmail("Admin@Example.COM")).toBe("admin@example.com");
  });

  it("trims and lowercases together", () => {
    expect(normalizeEmail("  Admin@Example.COM  ")).toBe("admin@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("admin@example.com")).toBe(true);
    expect(isValidEmail("first.last+tag@sub.example.co.uk")).toBe(true);
  });

  it("rejects emails missing an @", () => {
    expect(isValidEmail("admin.example.com")).toBe(false);
  });

  it("rejects emails missing a domain TLD", () => {
    expect(isValidEmail("admin@example")).toBe(false);
  });

  it("rejects emails with spaces", () => {
    expect(isValidEmail("admin @example.com")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});
