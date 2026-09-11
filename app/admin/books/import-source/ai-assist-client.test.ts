import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assistLearningMaterial,
  suggestModuleDescription,
  suggestModuleTitle,
} from "./ai-assist-client";

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

  it("includes moduleTitle/moduleDescription in the payload when supplied (ANA-98)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refined text" } }),
    );

    const moduleTitle = { ar: "عنوان", en: "Title" };
    const moduleDescription = { ar: "وصف", en: "Description" };

    await assistLearningMaterial({
      bookId: "book-1",
      text: "Text",
      language: "ar",
      moduleTitle,
      moduleDescription,
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/assist",
      expect.objectContaining({
        body: JSON.stringify({
          bookId: "book-1",
          text: "Text",
          language: "ar",
          moduleTitle,
          moduleDescription,
        }),
      }),
    );
  });
});

describe("suggestModuleTitle", () => {
  it("POSTs field: title, bookId, text, language, and moduleContent to /api/v1/ai/assist", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Suggested title" } }),
    );

    const moduleContent = { ar: "محتوى", en: "Content" };

    const result = await suggestModuleTitle({
      bookId: "book-1",
      text: "",
      language: "ar",
      moduleContent,
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        field: "title",
        text: "",
        language: "ar",
        moduleContent,
      }),
    });
    expect(result).toBe("Suggested title");
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "AI Assistant failed. Please try again." }, 502),
    );

    await expect(
      suggestModuleTitle({
        bookId: "book-1",
        text: "",
        language: "ar",
        moduleContent: { ar: "", en: "" },
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});

describe("suggestModuleDescription", () => {
  it("POSTs field: description, bookId, text, language, moduleTitle, and moduleContent to /api/v1/ai/assist", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Suggested description" } }),
    );

    const moduleTitle = { ar: "عنوان", en: "Title" };
    const moduleContent = { ar: "محتوى", en: "Content" };

    const result = await suggestModuleDescription({
      bookId: "book-1",
      text: "",
      language: "ar",
      moduleTitle,
      moduleContent,
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        field: "description",
        text: "",
        language: "ar",
        moduleTitle,
        moduleContent,
      }),
    });
    expect(result).toBe("Suggested description");
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "AI Assistant failed. Please try again." }, 502),
    );

    await expect(
      suggestModuleDescription({
        bookId: "book-1",
        text: "",
        language: "ar",
        moduleTitle: { ar: "", en: "" },
        moduleContent: { ar: "", en: "" },
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});
