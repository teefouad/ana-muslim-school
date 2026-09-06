import { describe, expect, it } from "vitest";

import { serializeAuditFields } from "./serialize-audit-fields";

describe("serializeAuditFields", () => {
  it("converts createdAt/updatedAt Dates to ISO strings, leaving other fields untouched", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-02-01T00:00:00.000Z");

    expect(
      serializeAuditFields({ id: "doc-1", title: "x", createdAt, updatedAt }),
    ).toEqual({
      id: "doc-1",
      title: "x",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });
});
