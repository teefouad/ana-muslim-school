import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMaterial, updateMaterial } from "./materials-client";

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

describe("createMaterial", () => {
  it("POSTs bookId, the persisted moduleId, and content to /api/v1/materials", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: {
          id: "material-1",
          bookId: "book-1",
          moduleId: "module-1",
          content: "md",
        },
      }),
    );

    const result = await createMaterial("book-1", "module-1", "md");

    expect(fetch).toHaveBeenCalledWith("/api/v1/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: "book-1",
        moduleId: "module-1",
        content: "md",
      }),
    });
    expect(result).toEqual({
      id: "material-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "md",
    });
  });

  it("persists an empty Learning Material string as-is", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: {
          id: "material-1",
          bookId: "book-1",
          moduleId: "module-1",
          content: "",
        },
      }),
    );

    await createMaterial("book-1", "module-1", "");

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/materials",
      expect.objectContaining({
        body: JSON.stringify({
          bookId: "book-1",
          moduleId: "module-1",
          content: "",
        }),
      }),
    );
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Something went wrong." }, 500),
    );

    await expect(createMaterial("book-1", "module-1", "md")).rejects.toThrow(
      "Something went wrong.",
    );
  });
});

describe("updateMaterial", () => {
  it("PATCHes content to /api/v1/materials/{id} and returns the updated Material", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: {
          id: "material-1",
          bookId: "book-1",
          moduleId: "module-1",
          content: "new md",
        },
      }),
    );

    const result = await updateMaterial("material-1", "new md");

    expect(fetch).toHaveBeenCalledWith("/api/v1/materials/material-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "new md" }),
    });
    expect(result).toEqual({
      id: "material-1",
      bookId: "book-1",
      moduleId: "module-1",
      content: "new md",
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Something went wrong." }, 500),
    );

    await expect(updateMaterial("material-1", "x")).rejects.toThrow(
      "Something went wrong.",
    );
  });
});
