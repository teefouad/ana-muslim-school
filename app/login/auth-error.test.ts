import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-error";

describe("getAuthErrorMessage", () => {
  it("maps known Firebase auth error codes to a friendly message", () => {
    expect(getAuthErrorMessage({ code: "auth/wrong-password" })).toBe(
      "Incorrect email or password.",
    );
    expect(getAuthErrorMessage({ code: "auth/email-already-in-use" })).toBe(
      "An account with this email already exists.",
    );
  });

  it("falls back to a generic message for unknown Firebase error codes", () => {
    expect(getAuthErrorMessage({ code: "auth/some-new-error" })).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("surfaces the message from a plain Error (e.g. our own API errors)", () => {
    expect(
      getAuthErrorMessage(
        new Error("This account is not authorized to access the admin area."),
      ),
    ).toBe("This account is not authorized to access the admin area.");
  });

  it("falls back to a generic message for anything else", () => {
    expect(getAuthErrorMessage("nope")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
