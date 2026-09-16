import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireBooksPermissionMock,
  createLessonServiceMock,
  listLessonsServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  createLessonServiceMock: vi.fn(),
  listLessonsServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/lessons/lessons-service", () => ({
  createLessonService: createLessonServiceMock,
  listLessonsService: listLessonsServiceMock,
}));

const { GET, POST } = await import("./route");

function context(bookId: string, moduleId: string) {
  return { params: Promise.resolve({ bookId, moduleId }) };
}

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/v1/books/book-1/modules/module-1/lessons",
    {
      method: "POST",
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

describe("GET /api/v1/books/[bookId]/modules/[moduleId]/lessons", () => {
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

  it("returns the serialized lessons on success", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    listLessonsServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [validLesson],
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

describe("POST /api/v1/books/[bookId]/modules/[moduleId]/lessons", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await POST(jsonRequest({}), context("book-1", "module-1"));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("creates the lesson and returns 201 with serialized dates", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    createLessonServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validLesson,
    });

    const response = await POST(
      jsonRequest({ position: 1 }),
      context("book-1", "module-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createLessonServiceMock).toHaveBeenCalledWith(
      "book-1",
      "module-1",
      { position: 1 },
      "a@example.com",
    );
    expect(body.data.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("maps an invalid-input service error (e.g. foreign question id) to 400", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    createLessonServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "invalid-input", message: "bad questions" },
    });

    const response = await POST(jsonRequest({}), context("book-1", "module-1"));

    expect(response.status).toBe(400);
  });
});
