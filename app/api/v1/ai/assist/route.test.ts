import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBooksPermissionMock, assistLearningMaterialServiceMock } =
  vi.hoisted(() => ({
    requireBooksPermissionMock: vi.fn(),
    assistLearningMaterialServiceMock: vi.fn(),
  }));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/ai/assist-learning-material-service", () => ({
  assistLearningMaterialService: assistLearningMaterialServiceMock,
}));

const { POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/v1/ai/assist", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await POST(
      jsonRequest({ bookId: "book-1", text: "النص", language: "ar" }),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(assistLearningMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid (non-JSON-object) request body", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
    expect(assistLearningMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("delegates the parsed body to the service and returns its data", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    assistLearningMaterialServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { text: "Refined text" },
    });

    const response = await POST(
      jsonRequest({
        bookId: "book-1",
        text: "النص العربي",
        language: "ar",
        additionalInstructions: "Use more headings",
      }),
    );
    const body = await response.json();

    expect(assistLearningMaterialServiceMock).toHaveBeenCalledWith({
      bookId: "book-1",
      text: "النص العربي",
      language: "ar",
      additionalInstructions: "Use more headings",
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { text: "Refined text" } });
  });

  it("maps a service failure to its HTTP status", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    assistLearningMaterialServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const response = await POST(
      jsonRequest({ bookId: "missing", text: "text", language: "ar" }),
    );

    expect(response.status).toBe(404);
  });
});
