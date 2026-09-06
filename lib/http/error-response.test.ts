import { describe, expect, it } from "vitest";

import { serviceErrorResponse } from "./error-response";

describe("serviceErrorResponse", () => {
  it.each([
    ["invalid-input", 400],
    ["not-found", 404],
    ["conflict", 409],
  ] as const)("maps %s to status %d", async (code, status) => {
    const response = serviceErrorResponse({ code, message: "boom" });

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "boom" });
  });
});
