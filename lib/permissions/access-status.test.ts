import { describe, expect, it } from "vitest";

import { getAccessStatus } from "./access-status";

describe("getAccessStatus", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("is Active when there is no expiration", () => {
    expect(getAccessStatus(null, now)).toBe("Active");
  });

  it("is Active when the expiration is in the future", () => {
    expect(getAccessStatus(new Date("2026-06-01T00:00:00.000Z"), now)).toBe(
      "Active",
    );
  });

  it("is Expired when the expiration is in the past", () => {
    expect(getAccessStatus(new Date("2025-06-01T00:00:00.000Z"), now)).toBe(
      "Expired",
    );
  });
});
