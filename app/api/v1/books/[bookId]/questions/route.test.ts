import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  getBookQuestionsGroupedByModuleServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  getBookQuestionsGroupedByModuleServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/questions/book-questions-service", () => ({
  getBookQuestionsGroupedByModuleService:
    getBookQuestionsGroupedByModuleServiceMock,
}));

const { GET } = await import("./route");

function context(bookId: string) {
  return { params: Promise.resolve({ bookId }) };
}

function request(query = "") {
  return new Request(`http://localhost/api/v1/books/book-1/questions${query}`);
}

const validQuestion = {
  id: "question-1",
  text: { ar: "أ", en: "a" },
  explanation: { ar: "أ", en: "a" },
  choices: [{ text: { ar: "أ", en: "a" }, isCorrect: true }],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/books/[bookId]/questions", () => {
  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await GET(request(), context("book-1"));

    expect(response.status).toBe(403);
    expect(getBookQuestionsGroupedByModuleServiceMock).not.toHaveBeenCalled();
  });

  it("returns the grouped, serialized questions on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getBookQuestionsGroupedByModuleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [{ moduleId: "module-1", questions: [validQuestion] }],
    });

    const response = await GET(request(), context("book-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getBookQuestionsGroupedByModuleServiceMock).toHaveBeenCalledWith(
      "book-1",
      false,
    );
    expect(body).toEqual({
      data: [
        {
          moduleId: "module-1",
          questions: [
            {
              ...validQuestion,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    });
  });

  it("passes forceRefresh=true when `refresh` is present", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getBookQuestionsGroupedByModuleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [],
    });

    await GET(request("?refresh"), context("book-1"));

    expect(getBookQuestionsGroupedByModuleServiceMock).toHaveBeenCalledWith(
      "book-1",
      true,
    );
  });

  it("passes forceRefresh=true when `invalidate` is present", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getBookQuestionsGroupedByModuleServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [],
    });

    await GET(request("?invalidate=1"), context("book-1"));

    expect(getBookQuestionsGroupedByModuleServiceMock).toHaveBeenCalledWith(
      "book-1",
      true,
    );
  });

  it("maps a not-found service error to 404", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    getBookQuestionsGroupedByModuleServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const response = await GET(request(), context("book-1"));

    expect(response.status).toBe(404);
  });
});
