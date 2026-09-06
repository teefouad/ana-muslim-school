import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requireBooksPermissionMock,
  getSourceByIdServiceMock,
  updateSourceServiceMock,
  deleteSourceServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  getSourceByIdServiceMock: vi.fn(),
  updateSourceServiceMock: vi.fn(),
  deleteSourceServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/sources/sources-service", () => ({
  getSourceByIdService: getSourceByIdServiceMock,
  updateSourceService: updateSourceServiceMock,
  deleteSourceService: deleteSourceServiceMock,
}));

const { GET, PATCH, DELETE } = await import("./route");

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
  return new Request("http://localhost/api/v1/sources/doc-1");
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/sources/doc-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/v1/sources/doc-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function deleteRequest() {
  return new Request("http://localhost/api/v1/sources/doc-1", {
    method: "DELETE",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/sources/[id]", () => {
  it("requires books.read", async () => {
    deny();

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
    expect(getSourceByIdServiceMock).not.toHaveBeenCalled();
  });

  it("returns the Source wrapped in a data envelope", async () => {
    allow();
    getSourceByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { id: "doc-1", bookId: "book-1", content: "x" },
    });

    const response = await GET(getRequest(), context("doc-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { id: "doc-1", bookId: "book-1", content: "x" },
    });
    expect(getSourceByIdServiceMock).toHaveBeenCalledWith("doc-1");
  });

  it("maps a not-found service error to 404", async () => {
    allow();
    getSourceByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Source not found." },
    });

    const response = await GET(getRequest(), context("missing"));

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/sources/[id]", () => {
  it("requires books.update", async () => {
    deny();

    const response = await PATCH(
      jsonRequest({ content: "y" }),
      context("doc-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(updateSourceServiceMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    allow();

    const response = await PATCH(rawRequest("{not valid"), context("doc-1"));

    expect(response.status).toBe(400);
    expect(updateSourceServiceMock).not.toHaveBeenCalled();
  });

  it("updates by the id from the route", async () => {
    allow();
    updateSourceServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { id: "doc-1", bookId: "book-1", content: "y" },
    });

    const response = await PATCH(
      jsonRequest({ content: "y" }),
      context("doc-1"),
    );

    expect(response.status).toBe(200);
    expect(updateSourceServiceMock).toHaveBeenCalledWith("doc-1", {
      content: "y",
    });
  });
});

describe("DELETE /api/v1/sources/[id]", () => {
  it("requires books.update", async () => {
    deny();

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(deleteSourceServiceMock).not.toHaveBeenCalled();
  });

  it("deletes by the id from the route", async () => {
    allow();
    deleteSourceServiceMock.mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });

    const response = await DELETE(deleteRequest(), context("doc-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deleteSourceServiceMock).toHaveBeenCalledWith("doc-1");
  });

  it("maps a not-found service error to 404", async () => {
    allow();
    deleteSourceServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Source not found." },
    });

    const response = await DELETE(deleteRequest(), context("missing"));

    expect(response.status).toBe(404);
  });
});
