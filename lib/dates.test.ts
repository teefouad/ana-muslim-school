import { describe, expect, it } from "vitest";
import dayjs from "dayjs";

import { toIsoStringOrNull } from "./dates";

describe("toIsoStringOrNull", () => {
  it("returns null for a null value", () => {
    expect(toIsoStringOrNull(null)).toBeNull();
  });

  it("produces a real ISO 8601 UTC string", () => {
    const iso = toIsoStringOrNull("2030-06-15 14:30:00");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("preserves the same local wall-clock time when converted back", () => {
    // Timezone-agnostic by design: whatever offset the test runner is in,
    // reinterpreting the ISO result in that same local zone must reproduce
    // the original input -- this is the exact property the client relies on
    // to send the admin's intended instant regardless of server timezone.
    const input = "2030-06-15 14:30:00";
    const iso = toIsoStringOrNull(input);
    expect(dayjs(iso).format("YYYY-MM-DD HH:mm:ss")).toBe(input);
  });
});
