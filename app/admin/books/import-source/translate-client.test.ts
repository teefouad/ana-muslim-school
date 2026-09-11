import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  translateArabicToEnglish,
  translateModuleField,
} from "./translate-client";

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

describe("translateArabicToEnglish", () => {
  it("POSTs the Arabic text to /api/v1/ai/translate and returns the translation", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Translated text" } }),
    );

    const result = await translateArabicToEnglish("النص العربي");

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "النص العربي" }),
    });
    expect(result).toBe("Translated text");
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Translation failed. Please try again." }, 502),
    );

    await expect(translateArabicToEnglish("النص العربي")).rejects.toThrow(
      "Translation failed. Please try again.",
    );
  });
});

describe("translateModuleField", () => {
  it("POSTs bookId/field/text/moduleTitle/moduleDescription/moduleContent to /api/v1/ai/translate and returns the translation", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Translated title" } }),
    );

    const moduleContent = "محتوى الوحدة";

    const result = await translateModuleField({
      bookId: "book-1",
      field: "title",
      text: "عنوان عربي",
      moduleContent,
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        field: "title",
        text: "عنوان عربي",
        moduleContent,
      }),
    });
    expect(result).toBe("Translated title");
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Translation failed. Please try again." }, 502),
    );

    await expect(
      translateModuleField({
        bookId: "book-1",
        field: "description",
        text: "وصف عربي",
      }),
    ).rejects.toThrow("Translation failed. Please try again.");
  });
});
