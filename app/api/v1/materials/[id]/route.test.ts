import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requireBooksPermissionMock,
  getMaterialByIdServiceMock,
  updateMaterialServiceMock,
  upsertMaterialServiceMock,
  deleteMaterialServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  getMaterialByIdServiceMock: vi.fn(),
  updateMaterialServiceMock: vi.fn(),
  upsertMaterialServiceMock: vi.fn(),
  deleteMaterialServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/materials/materials-service", () => ({
  getMaterialByIdService: getMaterialByIdServiceMock,
  updateMaterialService: updateMaterialServiceMock,
  upsertMaterialService: upsertMaterialServiceMock,
  deleteMaterialService: deleteMaterialServiceMock,
}));

const { GET, PATCH, PUT, DELETE } = await import("./route");

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

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getRequest() {
  return new Request("http://localhost/api/v1/materials/doc-1");
}

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/v1/materials/doc-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request("http://localhost/api/v1/materials/doc-1", {
    method: "DELETE",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/materials/[id]", () => {
  it("requires books.read", async () => {
    deny();

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(getMaterialByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns the Material by id", async () => {
    allow();
    getMaterialByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "doc-1",
        bookId: "book-1",
        moduleId: "module-1",
        content: { ar: "x", en: "" },
      },
    });

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(200);
    expect(getMaterialByIdServiceMock).toHaveBeenCalledWith("doc-1");
  });
});

describe("PATCH /api/v1/materials/[id]", () => {
  it("requires books.update and calls updateMaterialService (not upsert)", async () => {
    allow();
    updateMaterialServiceMock.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "doc-1",
        bookId: "book-1",
        moduleId: "module-1",
        content: { ar: "y", en: "" },
      },
    });

    const response = await PATCH(
      jsonRequest("PATCH", { content: { ar: "y", en: "" } }),
      context("doc-1"),
    );

    expect(response.status).toBe(200);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(updateMaterialServiceMock).toHaveBeenCalledWith("doc-1", {
      content: { ar: "y", en: "" },
    });
    expect(upsertMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("maps a not-found service error to 404 (PATCH fails if the Material doesn't exist)", async () => {
    allow();
    updateMaterialServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Material not found." },
    });

    const response = await PATCH(
      jsonRequest("PATCH", { content: { ar: "y", en: "" } }),
      context("missing"),
    );

    expect(response.status).toBe(404);
  });

  it("denies without books.update", async () => {
    deny();

    const response = await PATCH(
      jsonRequest("PATCH", { content: { ar: "y", en: "" } }),
      context("doc-1"),
    );

    expect(response.status).toBe(403);
    expect(updateMaterialServiceMock).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/materials/[id]", () => {
  it("requires books.update and calls upsertMaterialService (not update)", async () => {
    allow();
    upsertMaterialServiceMock.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "doc-1",
        bookId: "book-1",
        moduleId: "module-1",
        content: { ar: "z", en: "" },
      },
    });

    const response = await PUT(
      jsonRequest("PUT", {
        bookId: "book-1",
        moduleId: "module-1",
        content: { ar: "z", en: "" },
      }),
      context("doc-1"),
    );

    expect(response.status).toBe(200);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(upsertMaterialServiceMock).toHaveBeenCalledWith("doc-1", {
      bookId: "book-1",
      moduleId: "module-1",
      content: { ar: "z", en: "" },
    });
    expect(updateMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("denies without books.update", async () => {
    deny();

    const response = await PUT(
      jsonRequest("PUT", {
        bookId: "book-1",
        moduleId: "module-1",
        content: { ar: "z", en: "" },
      }),
      context("doc-1"),
    );

    expect(response.status).toBe(403);
    expect(upsertMaterialServiceMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/materials/[id]", () => {
  it("requires books.update", async () => {
    deny();

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(deleteMaterialServiceMock).not.toHaveBeenCalled();
  });

  it("deletes by the id from the route", async () => {
    allow();
    deleteMaterialServiceMock.mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deleteMaterialServiceMock).toHaveBeenCalledWith("doc-1");
  });
});
