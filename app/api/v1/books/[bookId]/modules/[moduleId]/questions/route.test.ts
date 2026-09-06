import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  createQuestionServiceMock,
  listQuestionsServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  createQuestionServiceMock: vi.fn(),
  listQuestionsServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/questions/questions-service", () => ({
  createQuestionService: createQuestionServiceMock,
  listQuestionsService: listQuestionsServiceMock,
}));

const { GET, POST } = await import("./route");

function context(bookId: string, moduleId: string) {
  return { params: Promise.resolve({ bookId, moduleId }) };
}

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/v1/books/book-1/modules/module-1/questions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
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

describe("GET /api/v1/books/[bookId]/modules/[moduleId]/questions", () => {
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

  it("returns the serialized questions on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    listQuestionsServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [validQuestion],
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1", "module-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("POST /api/v1/books/[bookId]/modules/[moduleId]/questions", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await POST(jsonRequest({}), context("book-1", "module-1"));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("creates the question and returns 201 with serialized dates", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    createQuestionServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validQuestion,
    });

    const response = await POST(
      jsonRequest({ text: validQuestion.text }),
      context("book-1", "module-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
