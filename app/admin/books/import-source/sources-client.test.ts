import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSource, deleteSource } from "./sources-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("createSource", () => {
  it("POSTs bookId and content to /api/v1/sources and returns the created Source", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: { id: "source-1", bookId: "book-1", content: "text" },
      }),
    );

    const result = await createSource("book-1", "text");

    expect(fetch).toHaveBeenCalledWith("/api/v1/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: "book-1", content: "text" }),
    });
    expect(result).toEqual({
      id: "source-1",
      bookId: "book-1",
      content: "text",
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Something went wrong." }, 500),
    );

    await expect(createSource("book-1", "text")).rejects.toThrow(
      "Something went wrong.",
    );
  });
});

describe("deleteSource", () => {
  it("DELETEs /api/v1/sources/{id}", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true }),
    );

    await deleteSource("source-1");

    expect(fetch).toHaveBeenCalledWith("/api/v1/sources/source-1", {
      method: "DELETE",
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Source not found." }, 404),
    );

    await expect(deleteSource("missing")).rejects.toThrow("Source not found.");
  });
});
