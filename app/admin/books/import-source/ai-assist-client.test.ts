import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assistLearningMaterial } from "./ai-assist-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistLearningMaterial", () => {
  it("POSTs bookId/text/language/additionalInstructions to /api/v1/ai/assist and returns the refined text", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refined text" } }),
    );

    const result = await assistLearningMaterial({
      bookId: "book-1",
      text: "النص العربي",
      language: "ar",
      additionalInstructions: "Use more headings",
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        text: "النص العربي",
        language: "ar",
        additionalInstructions: "Use more headings",
      }),
    });
    expect(result).toBe("Refined text");
  });

  it("omits additionalInstructions from the payload when not provided", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refined text" } }),
    );

    await assistLearningMaterial({
      bookId: "book-1",
      text: "Text",
      language: "en",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/assist",
      expect.objectContaining({
        body: JSON.stringify({
          bookId: "book-1",
          text: "Text",
          language: "en",
          additionalInstructions: undefined,
        }),
      }),
    );
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "AI Assistant failed. Please try again." }, 502),
    );

    await expect(
      assistLearningMaterial({
        bookId: "book-1",
        text: "Text",
        language: "ar",
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});
