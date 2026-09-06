import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  createBookServiceMock,
  listBooksServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  createBookServiceMock: vi.fn(),
  listBooksServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/books/books-service", () => ({
  createBookService: createBookServiceMock,
  listBooksService: listBooksServiceMock,
}));

const { GET, POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/books", {
    method: "POST",
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
  title: { ar: "أ", en: "a" },
  color: "#fff",
  modules: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/books", () => {
  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce(forbidden());

    const response = await GET();

    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
    expect(response.status).toBe(403);
    expect(listBooksServiceMock).not.toHaveBeenCalled();
  });

  it("serializes createdAt/updatedAt to ISO strings at the route boundary", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "admin@example.com",
    });
    listBooksServiceMock.mockResolvedValueOnce([bookWithDates]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(body.data[0].updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("POST /api/v1/books", () => {
  it("requires the create permission (not update)", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce(forbidden());

    const response = await POST(jsonRequest({}));

    expect(requireBooksPermissionMock).toHaveBeenCalledWith("create");
    expect(response.status).toBe(403);
    expect(createBookServiceMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 without calling the service", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "admin@example.com",
    });

    const response = await POST(rawRequest("{not valid json"));

    expect(response.status).toBe(400);
    expect(createBookServiceMock).not.toHaveBeenCalled();
  });

  it("returns 201 with the serialized created book", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "admin@example.com",
    });
    createBookServiceMock.mockResolvedValueOnce({
      ok: true,
      value: bookWithDates,
    });

    const response = await POST(jsonRequest({ title: { ar: "أ", en: "a" } }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(createBookServiceMock).toHaveBeenCalledWith(
      { title: { ar: "أ", en: "a" } },
      "admin@example.com",
    );
  });

  it("maps a service error to its HTTP status", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "admin@example.com",
    });
    createBookServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "invalid-input", message: "bad body" },
    });

    const response = await POST(jsonRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "bad body" });
  });
});
