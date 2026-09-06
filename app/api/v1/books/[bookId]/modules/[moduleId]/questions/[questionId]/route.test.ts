import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  deleteQuestionServiceMock,
  getQuestionByIdServiceMock,
  updateQuestionServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  deleteQuestionServiceMock: vi.fn(),
  getQuestionByIdServiceMock: vi.fn(),
  updateQuestionServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/questions/questions-service", () => ({
  deleteQuestionService: deleteQuestionServiceMock,
  getQuestionByIdService: getQuestionByIdServiceMock,
  updateQuestionService: updateQuestionServiceMock,
}));

const { GET, PATCH, DELETE } = await import("./route");

function context(bookId: string, moduleId: string, questionId: string) {
  return { params: Promise.resolve({ bookId, moduleId, questionId }) };
}

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/v1/books/book-1/modules/module-1/questions/question-1",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("GET /api/v1/books/[bookId]/modules/[moduleId]/questions/[questionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1", "module-1", "question-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
  });
});

describe("PATCH /api/v1/books/[bookId]/modules/[moduleId]/questions/[questionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await PATCH(
      jsonRequest({}),
      context("book-1", "module-1", "question-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });
});

describe("DELETE /api/v1/books/[bookId]/modules/[moduleId]/questions/[questionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1", "question-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("maps a conflict service error (still referenced by a Lesson) to 409", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    deleteQuestionServiceMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "conflict",
        message: "Question is still referenced by a Lesson.",
      },
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1", "question-1"),
    );

    expect(response.status).toBe(409);
  });

  it("returns { ok: true } on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    deleteQuestionServiceMock.mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1", "question-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
