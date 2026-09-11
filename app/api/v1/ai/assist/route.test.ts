import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  assistLearningMaterialServiceMock,
  suggestModuleTitleServiceMock,
  suggestModuleDescriptionServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  assistLearningMaterialServiceMock: vi.fn(),
  suggestModuleTitleServiceMock: vi.fn(),
  suggestModuleDescriptionServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/ai/assist-learning-material-service", () => ({
  assistLearningMaterialService: assistLearningMaterialServiceMock,
}));

vi.mock("@/lib/ai/suggest-module-title-service", () => ({
  suggestModuleTitleService: suggestModuleTitleServiceMock,
}));

vi.mock("@/lib/ai/suggest-module-description-service", () => ({
  suggestModuleDescriptionService: suggestModuleDescriptionServiceMock,
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

  it('routes field: "title" to suggestModuleTitleService', async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    suggestModuleTitleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { text: "Suggested title" },
    });

    const response = await POST(
      jsonRequest({
        bookId: "book-1",
        field: "title",
        text: "",
        language: "ar",
        moduleContent: { ar: "محتوى", en: "Content" },
      }),
    );
    const body = await response.json();

    expect(suggestModuleTitleServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: "title", bookId: "book-1" }),
    );
    expect(assistLearningMaterialServiceMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { text: "Suggested title" } });
  });

  it('routes field: "description" to suggestModuleDescriptionService', async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    suggestModuleDescriptionServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { text: "Suggested description" },
    });

    const response = await POST(
      jsonRequest({
        bookId: "book-1",
        field: "description",
        text: "",
        language: "ar",
        moduleTitle: { ar: "عنوان", en: "Title" },
        moduleContent: { ar: "محتوى", en: "Content" },
      }),
    );
    const body = await response.json();

    expect(suggestModuleDescriptionServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: "description", bookId: "book-1" }),
    );
    expect(assistLearningMaterialServiceMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { text: "Suggested description" } });
  });

  it('routes field: "content" to the existing assistLearningMaterialService, same as omitting field', async () => {
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
        field: "content",
        text: "Module text",
        language: "ar",
      }),
    );

    expect(assistLearningMaterialServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: "content" }),
    );
    expect(suggestModuleTitleServiceMock).not.toHaveBeenCalled();
    expect(suggestModuleDescriptionServiceMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("rejects an unrecognized field value", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await POST(
      jsonRequest({ bookId: "book-1", field: "color", text: "text" }),
    );

    expect(response.status).toBe(400);
    expect(assistLearningMaterialServiceMock).not.toHaveBeenCalled();
    expect(suggestModuleTitleServiceMock).not.toHaveBeenCalled();
    expect(suggestModuleDescriptionServiceMock).not.toHaveBeenCalled();
  });
});
