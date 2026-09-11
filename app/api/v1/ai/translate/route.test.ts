import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  translateArabicToEnglishServiceMock,
  translateModuleFieldServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  translateArabicToEnglishServiceMock: vi.fn(),
  translateModuleFieldServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/ai/translate-service", () => ({
  translateArabicToEnglishService: translateArabicToEnglishServiceMock,
}));

vi.mock("@/lib/ai/translate-module-field-service", () => ({
  translateModuleFieldService: translateModuleFieldServiceMock,
}));

const { POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/v1/ai/translate", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await POST(jsonRequest({ text: "النص" }));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(translateArabicToEnglishServiceMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid (non-JSON-object) request body", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
    expect(translateArabicToEnglishServiceMock).not.toHaveBeenCalled();
  });

  it("delegates the parsed body to the service and returns its data", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    translateArabicToEnglishServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { text: "Translated text" },
    });

    const response = await POST(jsonRequest({ text: "النص العربي" }));
    const body = await response.json();

    expect(translateArabicToEnglishServiceMock).toHaveBeenCalledWith({
      text: "النص العربي",
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { text: "Translated text" } });
  });

  it("maps a service failure to its HTTP status", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    translateArabicToEnglishServiceMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "invalid-input",
        message: "`text` must be a non-empty string.",
      },
    });

    const response = await POST(jsonRequest({ text: "" }));

    expect(response.status).toBe(400);
  });

  it("routes a request with `field` set to translateModuleFieldService instead of the plain, context-free service", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    translateModuleFieldServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { text: "Translated text" },
    });

    const response = await POST(
      jsonRequest({
        text: "النص العربي",
        field: "title",
        bookId: "book-1",
      }),
    );
    const body = await response.json();

    expect(translateModuleFieldServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: "title", bookId: "book-1" }),
    );
    expect(translateArabicToEnglishServiceMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { text: "Translated text" } });
  });

  it("rejects an unrecognized field value", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await POST(
      jsonRequest({ text: "النص", field: "color", bookId: "book-1" }),
    );

    expect(response.status).toBe(400);
    expect(translateArabicToEnglishServiceMock).not.toHaveBeenCalled();
    expect(translateModuleFieldServiceMock).not.toHaveBeenCalled();
  });
});
