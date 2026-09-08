import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createModule, deleteModule, reorderModules } from "./modules-client";

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

describe("createModule", () => {
  it("POSTs the draft fields to /api/v1/books/{bookId}/modules", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { id: "module-1" } }),
    );

    const draft = {
      title: { ar: "", en: "" },
      description: { ar: "", en: "" },
      color: "",
      isLocked: false,
      isPublished: false,
    };
    const result = await createModule("book-1", draft);

    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    expect(result).toEqual({ id: "module-1" });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Something went wrong." }, 500),
    );

    await expect(
      createModule("book-1", {
        title: { ar: "", en: "" },
        description: { ar: "", en: "" },
        color: "",
        isLocked: false,
        isPublished: false,
      }),
    ).rejects.toThrow("Something went wrong.");
  });
});

describe("deleteModule", () => {
  it("DELETEs /api/v1/books/{bookId}/modules/{moduleId}", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true }),
    );

    await deleteModule("book-1", "module-1");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/books/book-1/modules/module-1",
      { method: "DELETE" },
    );
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Module still has Lessons." }, 409),
    );

    await expect(deleteModule("book-1", "module-1")).rejects.toThrow(
      "Module still has Lessons.",
    );
  });
});

describe("reorderModules", () => {
  it("PATCHes /api/v1/books/{bookId} with the new module order", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: { id: "book-1", modules: ["module-2", "module-1"] },
      }),
    );

    const result = await reorderModules("book-1", ["module-2", "module-1"]);

    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: ["module-2", "module-1"] }),
    });
    expect(result).toEqual({ id: "book-1", modules: ["module-2", "module-1"] });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        {
          error:
            "`modules` must be a reorder of the exact current set of module ids.",
        },
        400,
      ),
    );

    await expect(reorderModules("book-1", ["module-1"])).rejects.toThrow(
      "`modules` must be a reorder of the exact current set of module ids.",
    );
  });
});
