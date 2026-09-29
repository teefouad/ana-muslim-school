import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assistLearningMaterial,
  suggestBookDescription,
  suggestBookLongDescription,
  suggestModuleDescription,
  suggestModuleTitle,
  toFieldValue,
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
      jsonResponse({ data: { ar: "Refined text" } }),
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
    expect(result).toEqual({ ar: "Refined text" });
  });

  it("omits additionalInstructions from the payload when not provided", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { ar: "Refined text" } }),
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
      jsonResponse({ data: { ar: "Refined text" } }),
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
      jsonResponse({ data: { ar: "Refined excerpt" } }),
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
      jsonResponse({ data: { ar: "Suggested title" } }),
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
    expect(result).toEqual({ ar: "Suggested title" });
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
      jsonResponse({ data: { ar: "Suggested description" } }),
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
    expect(result).toEqual({ ar: "Suggested description" });
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

describe("suggestBookDescription", () => {
  it("POSTs field: bookDescription with both languages of text, bookTitle, and bookLongDescription, with no bookId, and returns both languages (ANA-100, ANA-135)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { ar: "وصف مقترح", en: "Suggested description" } }),
    );

    const result = await suggestBookDescription({
      text: { ar: "وصف حالي", en: "Current" },
      bookTitle: { ar: "عنوان", en: "Title" },
      bookLongDescription: { ar: "وصف طويل", en: "" },
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: "bookDescription",
        text: "وصف حالي",
        textEn: "Current",
        bookTitle: "عنوان",
        bookTitleEn: "Title",
        bookLongDescription: "وصف طويل",
        bookLongDescriptionEn: "",
      }),
    });
    expect(result).toEqual({ ar: "وصف مقترح", en: "Suggested description" });
  });

  it("sends the selected Modules' ids with the Book id, only when some are selected (ANA-133)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      jsonResponse({ data: { ar: "ع", en: "e" } }),
    );
    const empty = { ar: "", en: "" };

    await suggestBookDescription({
      text: empty,
      bookTitle: empty,
      bookLongDescription: empty,
      bookId: "book-1",
      moduleIds: ["m1"],
    });
    await suggestBookDescription({
      text: empty,
      bookTitle: empty,
      bookLongDescription: empty,
      bookId: "book-1",
      moduleIds: [],
    });

    const [first, second] = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => JSON.parse(call[1].body as string),
    );
    expect(first).toMatchObject({ bookId: "book-1", moduleIds: ["m1"] });
    expect(second).not.toHaveProperty("bookId");
    expect(second).not.toHaveProperty("moduleIds");
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "AI Assistant failed. Please try again." }, 502),
    );
    const empty = { ar: "", en: "" };

    await expect(
      suggestBookDescription({
        text: empty,
        bookTitle: empty,
        bookLongDescription: empty,
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});

describe("suggestBookLongDescription", () => {
  it("POSTs field: bookLongDescription with both languages of text, bookTitle, and bookDescription, with no bookId, and returns both languages (ANA-100, ANA-135)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: { ar: "وصف طويل مقترح", en: "Suggested long description" },
      }),
    );

    const result = await suggestBookLongDescription({
      text: { ar: "", en: "Current long" },
      bookTitle: { ar: "عنوان", en: "Title" },
      bookDescription: { ar: "وصف", en: "Description" },
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: "bookLongDescription",
        text: "",
        textEn: "Current long",
        bookTitle: "عنوان",
        bookTitleEn: "Title",
        bookDescription: "وصف",
        bookDescriptionEn: "Description",
      }),
    });
    expect(result).toEqual({
      ar: "وصف طويل مقترح",
      en: "Suggested long description",
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "AI Assistant failed. Please try again." }, 502),
    );
    const empty = { ar: "", en: "" };

    await expect(
      suggestBookLongDescription({
        text: empty,
        bookTitle: empty,
        bookDescription: empty,
      }),
    ).rejects.toThrow("AI Assistant failed. Please try again.");
  });
});

describe("toFieldValue", () => {
  it("keeps both languages, and omits an absent English (a selection)", () => {
    expect(toFieldValue({ ar: "ع", en: "e" })).toEqual({ ar: "ع", en: "e" });
    expect(toFieldValue({ ar: "ع" })).toEqual({ ar: "ع" });
  });
});
