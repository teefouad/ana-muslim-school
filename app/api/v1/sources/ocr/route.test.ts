import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { requireBooksPermissionMock, getSessionUserMock, runOcrServiceMock } =
  vi.hoisted(() => ({
    requireBooksPermissionMock: vi.fn(),
    getSessionUserMock: vi.fn(),
    runOcrServiceMock: vi.fn(),
  }));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/sources/ocr-service", () => ({
  runOcrService: runOcrServiceMock,
}));

const { POST } = await import("./route");

function allow() {
  requireBooksPermissionMock.mockResolvedValueOnce({
    ok: true,
    actorEmail: "admin@example.com",
  });
  getSessionUserMock.mockResolvedValueOnce({
    uid: "user-1",
    email: "admin@example.com",
  });
}

function deny() {
  requireBooksPermissionMock.mockResolvedValueOnce({
    ok: false,
    response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
  });
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/sources/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/sources/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/v1/sources/ocr", () => {
  it("requires books.update", async () => {
    deny();

    const response = await POST(
      jsonRequest({ objectPath: "tmp/ocr-uploads/user-1/a.pdf", pages: [1] }),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(runOcrServiceMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 without calling the service", async () => {
    allow();

    const response = await POST(rawRequest("{not valid json"));

    expect(response.status).toBe(400);
    expect(runOcrServiceMock).not.toHaveBeenCalled();
  });

  it("passes the authenticated user's uid alongside the request body to the service", async () => {
    allow();
    runOcrServiceMock.mockResolvedValueOnce({
      ok: true,
      value: {
        model: "mistral-ocr-latest",
        pagesProcessed: 1,
        docSizeBytes: 1024,
        pages: [{ pageNumber: 1, markdown: "# Hello" }],
      },
    });

    const response = await POST(
      jsonRequest({ objectPath: "tmp/ocr-uploads/user-1/a.pdf", pages: [1] }),
    );

    expect(runOcrServiceMock).toHaveBeenCalledWith({
      uid: "user-1",
      objectPath: "tmp/ocr-uploads/user-1/a.pdf",
      pages: [1],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        model: "mistral-ocr-latest",
        pagesProcessed: 1,
        docSizeBytes: 1024,
        pages: [{ pageNumber: 1, markdown: "# Hello" }],
      },
    });
  });

  it("maps a service failure to the equivalent HTTP status", async () => {
    allow();
    runOcrServiceMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "too-large",
        message: "The PDF exceeds the 100 MB size limit.",
      },
    });

    const response = await POST(
      jsonRequest({ objectPath: "tmp/ocr-uploads/user-1/a.pdf", pages: [1] }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "The PDF exceeds the 100 MB size limit.",
    });
  });
});
