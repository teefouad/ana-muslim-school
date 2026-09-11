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
  it("POSTs bookId/text/additionalInstructions to /api/v1/ai/assist and returns the refined text", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refined text" } }),
    );

    const result = await assistLearningMaterial({
      bookId: "book-1",
      text: "النص العربي",
      additionalInstructions: "Use more headings",
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        text: "النص العربي",
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
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/assist",
      expect.objectContaining({
        body: JSON.stringify({
          bookId: "book-1",
          text: "Text",
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
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });

  it("includes moduleTitle/moduleDescription in the payload when supplied (ANA-98/ANA-99)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refined text" } }),
    );

    await assistLearningMaterial({
      bookId: "book-1",
      text: "Text",
      moduleTitle: "عنوان",
      moduleDescription: "وصف",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/assist",
      expect.objectContaining({
        body: JSON.stringify({
          bookId: "book-1",
          text: "Text",
          moduleTitle: "عنوان",
          moduleDescription: "وصف",
        }),
      }),
    );
  });

  it("includes fullMaterial in the payload when supplied, for a Markdown selection (ANA-99)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refined excerpt" } }),
    );

    await assistLearningMaterial({
      bookId: "book-1",
      text: "Selected excerpt",
      fullMaterial: "The complete Learning Material",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/assist",
      expect.objectContaining({
        body: JSON.stringify({
          bookId: "book-1",
          text: "Selected excerpt",
          fullMaterial: "The complete Learning Material",
        }),
      }),
    );
  });
});

describe("suggestModuleTitle", () => {
  it("POSTs field: title, bookId, text, and moduleContent to /api/v1/ai/assist", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Suggested title" } }),
    );

    const result = await suggestModuleTitle({
      bookId: "book-1",
      text: "",
      moduleContent: "محتوى",
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        field: "title",
        text: "",
        moduleContent: "محتوى",
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
        moduleContent: "",
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});

describe("suggestModuleDescription", () => {
  it("POSTs field: description, bookId, text, moduleTitle, and moduleContent to /api/v1/ai/assist", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Suggested description" } }),
    );

    const result = await suggestModuleDescription({
      bookId: "book-1",
      text: "",
      moduleTitle: "عنوان",
      moduleContent: "محتوى",
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        field: "description",
        text: "",
        moduleTitle: "عنوان",
        moduleContent: "محتوى",
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
        moduleTitle: "",
        moduleContent: "",
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});
