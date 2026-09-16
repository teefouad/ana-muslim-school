import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  deleteLessonServiceMock,
  getLessonByIdServiceMock,
  updateLessonServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  deleteLessonServiceMock: vi.fn(),
  getLessonByIdServiceMock: vi.fn(),
  updateLessonServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/lessons/lessons-service", () => ({
  deleteLessonService: deleteLessonServiceMock,
  getLessonByIdService: getLessonByIdServiceMock,
  updateLessonService: updateLessonServiceMock,
}));

const { GET, PATCH, DELETE } = await import("./route");

function context(bookId: string, moduleId: string, lessonId: string) {
  return { params: Promise.resolve({ bookId, moduleId, lessonId }) };
}

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/v1/books/book-1/modules/module-1/lessons/lesson-1",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const validLesson = {
  id: "lesson-1",
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  type: "text",
  position: 1,
  reward: { coins: 0 },
  content: { ar: "", en: "" },
  duration: 0,
  videoURL: "",
  azkar: [],
  questions: [],
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

describe("GET /api/v1/books/[bookId]/modules/[moduleId]/lessons/[lessonId]", () => {
  it("requires the read permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost"),
      context("book-1", "module-1", "lesson-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("read");
  });
});

describe("PATCH /api/v1/books/[bookId]/modules/[moduleId]/lessons/[lessonId]", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await PATCH(
      jsonRequest({}),
      context("book-1", "module-1", "lesson-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("forwards the parsed body including questions references to the service", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    updateLessonServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validLesson,
    });

    await PATCH(
      jsonRequest({ questions: ["question-1"] }),
      context("book-1", "module-1", "lesson-1"),
    );

    expect(updateLessonServiceMock).toHaveBeenCalledWith(
      "book-1",
      "module-1",
      "lesson-1",
      { questions: ["question-1"] },
      "a@example.com",
    );
  });
});

describe("DELETE /api/v1/books/[bookId]/modules/[moduleId]/lessons/[lessonId]", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1", "lesson-1"),
    );

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("returns { ok: true } on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    deleteLessonServiceMock.mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      context("book-1", "module-1", "lesson-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
