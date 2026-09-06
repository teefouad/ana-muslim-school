import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  deleteModuleServiceMock,
  getModuleByIdServiceMock,
  updateModuleServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  deleteModuleServiceMock: vi.fn(),
  getModuleByIdServiceMock: vi.fn(),
  updateModuleServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/modules/modules-service", () => ({
  deleteModuleService: deleteModuleServiceMock,
  getModuleByIdService: getModuleByIdServiceMock,
  updateModuleService: updateModuleServiceMock,
}));

const { GET, PATCH, DELETE } = await import("./route");

function context(bookId: string, moduleId: string) {
  return { params: Promise.resolve({ bookId, moduleId }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/books/book-1/modules/module-1", {
    method: "PATCH",
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

describe("GET /api/v1/books/[bookId]/modules/[moduleId]", () => {
  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1", "module-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
  });

  it("returns the serialized module on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getModuleByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validModule,
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1", "module-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("PATCH /api/v1/books/[bookId]/modules/[moduleId]", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await PATCH(
      jsonRequest({}),
      context("book-1", "module-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("forwards the parsed body and actor to the service", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    updateModuleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validModule,
    });

    await PATCH(jsonRequest({ color: "#000" }), context("book-1", "module-1"));

    expect(updateModuleServiceMock).toHaveBeenCalledWith(
      "book-1",
      "module-1",
      { color: "#000" },
      "a@example.com",
    );
  });
});

describe("DELETE /api/v1/books/[bookId]/modules/[moduleId]", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("maps a conflict service error to 409", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    deleteModuleServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "conflict", message: "Module still has Lessons." },
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1"),
    );

    expect(response.status).toBe(409);
  });

  it("returns { ok: true } on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    deleteModuleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
