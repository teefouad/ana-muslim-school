import { beforeEach, describe, expect, it, vi } from "vitest";

const { listModulesServiceMock, listQuestionsMock } = vi.hoisted(() => ({
  listModulesServiceMock: vi.fn(),
  listQuestionsMock: vi.fn(),
}));

vi.mock("@/lib/modules/modules-service", () => ({
  listModulesService: listModulesServiceMock,
}));

vi.mock("./questions-repository", () => ({
  listQuestions: listQuestionsMock,
}));

const { getBookQuestionsGroupedByModuleService } =
  await import("./book-questions-service");

const validModule = (id: string) => ({
  id,
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  color: "#fff",
  lessons: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
});

const validQuestion = (id: string) => ({
  id,
  text: { ar: "أ", en: "a" },
  explanation: { ar: "أ", en: "a" },
  choices: [{ text: { ar: "أ", en: "a" }, isCorrect: true }],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getBookQuestionsGroupedByModuleService", () => {
  it("returns the not-found error when the book doesn't exist", async () => {
    listModulesServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });

    const result = await getBookQuestionsGroupedByModuleService(
      "missing-book",
      false,
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "not-found", message: "Book not found." },
    });
    expect(listQuestionsMock).not.toHaveBeenCalled();
  });

  it("loads and caches every module's questions on a first request", async () => {
    listModulesServiceMock.mockResolvedValueOnce({
      ok: true,
      value: [validModule("module-1"), validModule("module-2")],
    });
    listQuestionsMock
      .mockResolvedValueOnce([validQuestion("q1")])
      .mockResolvedValueOnce([]);

    const result = await getBookQuestionsGroupedByModuleService(
      "book-1",
      false,
    );

    expect(result).toEqual({
      ok: true,
      value: [
        { moduleId: "module-1", questions: [validQuestion("q1")] },
        { moduleId: "module-2", questions: [] },
      ],
    });
    expect(listQuestionsMock).toHaveBeenCalledTimes(2);

    // Second request should now be served from the cache.
    const second = await getBookQuestionsGroupedByModuleService(
      "book-1",
      false,
    );

    expect(second).toEqual(result);
    expect(listQuestionsMock).toHaveBeenCalledTimes(2);
    expect(listModulesServiceMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses and replaces the cache when forceRefresh is set", async () => {
    listModulesServiceMock.mockResolvedValue({
      ok: true,
      value: [validModule("module-1")],
    });
    listQuestionsMock
      .mockResolvedValueOnce([validQuestion("q1")])
      .mockResolvedValueOnce([validQuestion("q1"), validQuestion("q2")]);

    const first = await getBookQuestionsGroupedByModuleService("book-2", false);
    expect(first).toEqual({
      ok: true,
      value: [{ moduleId: "module-1", questions: [validQuestion("q1")] }],
    });

    const refreshed = await getBookQuestionsGroupedByModuleService(
      "book-2",
      true,
    );

    expect(refreshed).toEqual({
      ok: true,
      value: [
        {
          moduleId: "module-1",
          questions: [validQuestion("q1"), validQuestion("q2")],
        },
      ],
    });
    expect(listModulesServiceMock).toHaveBeenCalledTimes(2);

    // A subsequent uncached request should now see the refreshed value.
    const cached = await getBookQuestionsGroupedByModuleService(
      "book-2",
      false,
    );
    expect(cached).toEqual(refreshed);
    expect(listModulesServiceMock).toHaveBeenCalledTimes(2);
  });
});
