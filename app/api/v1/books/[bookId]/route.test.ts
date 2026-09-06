import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  getBookByIdServiceMock,
  updateBookServiceMock,
  deleteBookServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  getBookByIdServiceMock: vi.fn(),
  updateBookServiceMock: vi.fn(),
  deleteBookServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/books/books-service", () => ({
  getBookByIdService: getBookByIdServiceMock,
  updateBookService: updateBookServiceMock,
  deleteBookService: deleteBookServiceMock,
}));

const { GET, PATCH, DELETE } = await import("./route");

function context(bookId: string) {
  return { params: Promise.resolve({ bookId }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/books/book-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/books/book-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function forbidden() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: "Forbidden." }), {
      status: 403,
    }),
  };
}

const bookWithDates = {
  id: "book-1",
  color: "#fff",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/books/[bookId]", () => {
  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce(forbidden());

    const response = await GET(
      new Request("http://localhost"),
      context("book-1"),
    );

    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
    expect(response.status).toBe(403);
    expect(getBookByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns the serialized book", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: bookWithDates,
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(getBookByIdServiceMock).toHaveBeenCalledWith("book-1");
  });

  it("maps not-found to 404", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getBookByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const response = await GET(
      new Request("http://localhost"),
      context("missing"),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/books/[bookId]", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce(forbidden());

    const response = await PATCH(jsonRequest({}), context("book-1"));

    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(response.status).toBe(403);
    expect(updateBookServiceMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 without calling the service", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await PATCH(
      rawRequest("{not valid json"),
      context("book-1"),
    );

    expect(response.status).toBe(400);
    expect(updateBookServiceMock).not.toHaveBeenCalled();
  });

  it("forwards the bookId, body, and actor to the service and serializes the result", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    updateBookServiceMock.mockResolvedValueOnce({
      ok: true,
      value: bookWithDates,
    });

    const response = await PATCH(
      jsonRequest({ color: "#000" }),
      context("book-1"),
    );
    const body = await response.json();

    expect(updateBookServiceMock).toHaveBeenCalledWith(
      "book-1",
      { color: "#000" },
      "a@example.com",
    );
    expect(body.data.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("DELETE /api/v1/books/[bookId]", () => {
  it("requires the delete permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce(forbidden());

    const response = await DELETE(
      new Request("http://localhost"),
      context("book-1"),
    );

    expect(requireBooksPermissionMock).toHaveBeenCalledWith("delete");
    expect(response.status).toBe(403);
    expect(deleteBookServiceMock).not.toHaveBeenCalled();
  });

  it("deletes the book and returns { ok: true }", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    deleteBookServiceMock.mockResolvedValueOnce({ ok: true, value: undefined });

    const response = await DELETE(
      new Request("http://localhost"),
      context("book-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deleteBookServiceMock).toHaveBeenCalledWith("book-1");
  });
});
