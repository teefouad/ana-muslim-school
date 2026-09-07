import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requireBooksPermissionMock,
  createMaterialServiceMock,
  listMaterialsServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  createMaterialServiceMock: vi.fn(),
  listMaterialsServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/materials/materials-service", () => ({
  createMaterialService: createMaterialServiceMock,
  listMaterialsService: listMaterialsServiceMock,
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
  return new Request("http://localhost/api/v1/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

function listRequest(query = "") {
  return new Request(`http://localhost/api/v1/materials${query}`);
}

describe("GET /api/v1/materials", () => {
  it("requires books.read", async () => {
    deny();

    const response = await GET(listRequest());

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
    expect(listMaterialsServiceMock).not.toHaveBeenCalled();
  });

  it("returns the list wrapped in a data envelope", async () => {
    allow();
    listMaterialsServiceMock.mockResolvedValueOnce([{ id: "doc-1" }]);

    const response = await GET(listRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "doc-1" }] });
    expect(listMaterialsServiceMock).toHaveBeenCalledWith(undefined);
  });

  it("forwards a `bookId` query param as a Book filter", async () => {
    allow();
    listMaterialsServiceMock.mockResolvedValueOnce([
      { id: "doc-1", bookId: "book-1", moduleId: "module-1", content: "x" },
    ]);

    const response = await GET(listRequest("?bookId=book-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        { id: "doc-1", bookId: "book-1", moduleId: "module-1", content: "x" },
      ],
    });
    expect(listMaterialsServiceMock).toHaveBeenCalledWith("book-1");
  });

  it("treats an empty/whitespace-only `bookId` as no filter", async () => {
    allow();
    listMaterialsServiceMock.mockResolvedValueOnce([]);

    const response = await GET(listRequest("?bookId=%20%20"));

    expect(response.status).toBe(200);
    expect(listMaterialsServiceMock).toHaveBeenCalledWith(undefined);
  });
});

describe("POST /api/v1/materials", () => {
  it("requires books.update, not books.create", async () => {
    deny();

    const response = await POST(
      jsonRequest({ bookId: "book-1", moduleId: "module-1", content: "x" }),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(createMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 without calling the service", async () => {
    allow();

    const response = await POST(rawRequest("{not valid json"));

    expect(response.status).toBe(400);
    expect(createMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("creates with a server-generated id and returns 201", async () => {
    allow();
    createMaterialServiceMock.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "auto-id",
        bookId: "book-1",
        moduleId: "module-1",
        content: "x",
      },
    });

    const response = await POST(
      jsonRequest({ bookId: "book-1", moduleId: "module-1", content: "x" }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        id: "auto-id",
        bookId: "book-1",
        moduleId: "module-1",
        content: "x",
      },
    });
  });

  it("maps an invalid-input service error to 400", async () => {
    allow();
    createMaterialServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "invalid-input", message: "bad input" },
    });

    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
  });
});
