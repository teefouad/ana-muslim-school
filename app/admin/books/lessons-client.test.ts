import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLesson, reorderLessons } from "./lessons-client";

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

describe("createLesson", () => {
  it("POSTs the default Lesson fields to /api/v1/books/{bookId}/modules/{moduleId}/lessons", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { id: "lesson-1" } }),
    );

    const result = await createLesson("book-1", "module-1");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/books/book-1/modules/module-1/lessons",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: { ar: "", en: "" },
          description: { ar: "", en: "" },
          type: "text",
          position: 2,
          reward: { coins: 0 },
          duration: 0,
          videoURL: "",
          azkar: [],
          questions: [],
          isLocked: false,
          isPublished: false,
        }),
      },
    );
    expect(result).toEqual({ id: "lesson-1" });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Something went wrong." }, 500),
    );

    await expect(createLesson("book-1", "module-1")).rejects.toThrow(
      "Something went wrong.",
    );
  });
});

describe("reorderLessons", () => {
  it("PATCHes /api/v1/books/{bookId}/modules/{moduleId} with the new lesson order", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: { id: "module-1", lessons: ["lesson-2", "lesson-1"] },
      }),
    );

    const result = await reorderLessons("book-1", "module-1", [
      "lesson-2",
      "lesson-1",
    ]);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/books/book-1/modules/module-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: ["lesson-2", "lesson-1"] }),
      },
    );
    expect(result).toEqual({
      id: "module-1",
      lessons: ["lesson-2", "lesson-1"],
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        {
          error:
            "`lessons` must be a reorder of the exact current set of lesson ids.",
        },
        400,
      ),
    );

    await expect(
      reorderLessons("book-1", "module-1", ["lesson-1"]),
    ).rejects.toThrow(
      "`lessons` must be a reorder of the exact current set of lesson ids.",
    );
  });
});
