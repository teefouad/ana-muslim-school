import { describe, expect, it } from "vitest";

import { parsePermissionInput } from "./parse-permission-input";

const validBody = {
  email: "  User@Example.com  ",
  permissions: {
    books: { read: true, create: false, update: true, delete: false },
    users: { manage: true },
  },
  expiresAt: "2026-06-01T12:00",
};

describe("parsePermissionInput", () => {
  it("normalizes the email and preserves permission flags", () => {
    const result = parsePermissionInput(validBody);

    expect(result).toEqual({
      ok: true,
      value: {
        email: "user@example.com",
        permissions: {
          books: { read: true, create: false, update: true, delete: false },
          users: { manage: true },
        },
        expiresAt: new Date("2026-06-01T12:00"),
      },
    });
  });

  it("treats a missing expiration as no expiration", () => {
    const result = parsePermissionInput({ ...validBody, expiresAt: undefined });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.expiresAt).toBeNull();
  });

  it("rejects an invalid email", () => {
    const result = parsePermissionInput({
      ...validBody,
      email: "not-an-email",
    });

    expect(result).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
  });

  it("rejects a missing email", () => {
    const result = parsePermissionInput({ ...validBody, email: undefined });

    expect(result.ok).toBe(false);
  });

  it("rejects an unparseable expiration date", () => {
    const result = parsePermissionInput({
      ...validBody,
      expiresAt: "not-a-date",
    });

    expect(result).toEqual({ ok: false, error: "Invalid expiration date." });
  });

  it("defaults missing/malformed permission flags to false", () => {
    const result = parsePermissionInput({ email: "user@example.com" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.permissions).toEqual({
      books: { read: false, create: false, update: false, delete: false },
      users: { manage: false },
    });
  });

  it("rejects a completely malformed payload", () => {
    expect(parsePermissionInput(null).ok).toBe(false);
    expect(parsePermissionInput(undefined).ok).toBe(false);
  });
});
