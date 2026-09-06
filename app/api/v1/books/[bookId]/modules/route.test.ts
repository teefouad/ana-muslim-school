import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  createModuleServiceMock,
  listModulesServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  createModuleServiceMock: vi.fn(),
  listModulesServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/modules/modules-service", () => ({
  createModuleService: createModuleServiceMock,
  listModulesService: listModulesServiceMock,
}));

const { GET, POST } = await import("./route");

function context(bookId: string) {
  return { params: Promise.resolve({ bookId }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/books/book-1/modules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validModule = {
  id: "module-1",
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  color: "#fff",
  lessons: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/books/[bookId]/modules", () => {
  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
    expect(listModulesServiceMock).not.toHaveBeenCalled();
  });

  it("returns the serialized modules on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    listModulesServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [validModule],
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("POST /api/v1/books/[bookId]/modules", () => {
  it("requires the update permission (not create)", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await POST(jsonRequest({}), context("book-1"));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("rejects malformed JSON with 400", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/books/book-1/modules", {
        method: "POST",
        body: "{not json",
      }),
      context("book-1"),
    );

    expect(response.status).toBe(400);
    expect(createModuleServiceMock).not.toHaveBeenCalled();
  });

  it("creates the module and returns 201 with the serialized dates", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    createModuleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validModule,
    });

    const response = await POST(
      jsonRequest({ title: { ar: "أ", en: "a" } }),
      context("book-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createModuleServiceMock).toHaveBeenCalledWith(
      "book-1",
      { title: { ar: "أ", en: "a" } },
      "a@example.com",
    );
    expect(body.data.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("maps a not-found service error to 404", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    createModuleServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const response = await POST(jsonRequest({}), context("book-1"));

    expect(response.status).toBe(404);
  });
});
