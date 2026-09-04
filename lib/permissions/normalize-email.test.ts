import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./normalize-email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  admin@example.com  ")).toBe("admin@example.com");
  });

  it("lowercases the email", () => {
    expect(normalizeEmail("Admin@Example.com")).toBe("admin@example.com");
  });

  it("does both at once", () => {
    expect(normalizeEmail("  Admin@Example.com  ")).toBe("admin@example.com");
  });
});
