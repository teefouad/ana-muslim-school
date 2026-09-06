import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requireBooksPermissionMock,
  createSourceServiceMock,
  listSourcesServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  createSourceServiceMock: vi.fn(),
  listSourcesServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/sources/sources-service", () => ({
  createSourceService: createSourceServiceMock,
  listSourcesService: listSourcesServiceMock,
}));

const { GET, POST } = await import("./route");

function allow() {
  requireBooksPermissionMock.mockResolvedValueOnce({
    ok: true,
    actorEmail: "admin@example.com",
  });
}

function deny() {
  requireBooksPermissionMock.mockResolvedValueOnce({
    ok: false,
    response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
  });
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/sources", () => {
  it("requires books.read", async () => {
    deny();

    const response = await GET();

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
    expect(listSourcesServiceMock).not.toHaveBeenCalled();
  });

  it("returns the list wrapped in a data envelope", async () => {
    allow();
    listSourcesServiceMock.mockResolvedValueOnce([{ id: "doc-1" }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "doc-1" }] });
  });
});

describe("POST /api/v1/sources", () => {
  it("requires books.update, not books.create", async () => {
    deny();

    const response = await POST(
      jsonRequest({ bookId: "book-1", content: "x" }),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(createSourceServiceMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 without calling the service", async () => {
    allow();

    const response = await POST(rawRequest("{not valid json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid request body." });
    expect(createSourceServiceMock).not.toHaveBeenCalled();
  });

  it("returns 201 with the created Source on success", async () => {
    allow();
    createSourceServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { id: "doc-1", bookId: "book-1", content: "x" },
    });

    const response = await POST(
      jsonRequest({ bookId: "book-1", content: "x" }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: { id: "doc-1", bookId: "book-1", content: "x" },
    });
    expect(createSourceServiceMock).toHaveBeenCalledWith({
      bookId: "book-1",
      content: "x",
    });
  });

  it("maps an invalid-input service error to 400", async () => {
    allow();
    createSourceServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "invalid-input", message: "bad input" },
    });

    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad input" });
  });
});
