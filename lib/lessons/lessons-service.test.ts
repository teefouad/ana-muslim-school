import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getModuleByIdServiceMock,
  validateModulePathMock,
  allQuestionsExistMock,
  createLessonInRepoMock,
  deleteLessonByIdMock,
  getLessonByIdFromRepoMock,
  listLessonsByIdsMock,
  updateLessonByIdMock,
} = vi.hoisted(() => ({
  getModuleByIdServiceMock: vi.fn(),
  validateModulePathMock: vi.fn(),
  allQuestionsExistMock: vi.fn(),
  createLessonInRepoMock: vi.fn(),
  deleteLessonByIdMock: vi.fn(),
  getLessonByIdFromRepoMock: vi.fn(),
  listLessonsByIdsMock: vi.fn(),
  updateLessonByIdMock: vi.fn(),
}));

vi.mock("@/lib/modules/modules-service", () => ({
  getModuleByIdService: getModuleByIdServiceMock,
  validateModulePath: validateModulePathMock,
}));

vi.mock("@/lib/questions/questions-repository", () => ({
  allQuestionsExist: allQuestionsExistMock,
}));

vi.mock("./lessons-repository", () => ({
  createLesson: createLessonInRepoMock,
  deleteLessonById: deleteLessonByIdMock,
  getLessonById: getLessonByIdFromRepoMock,
  listLessonsByIds: listLessonsByIdsMock,
  updateLessonById: updateLessonByIdMock,
}));

const {
  createLessonService,
  deleteLessonService,
  getLessonByIdService,
  listLessonsService,
  updateLessonService,
} = await import("./lessons-service");

const validLesson = {
  id: "lesson-1",
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  type: "text",
  position: 1,
  reward: { coins: 0 },
  duration: 0,
  videoURL: "",
  azkar: [],
  questions: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

const validModule = {
  id: "module-1",
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  color: "#fff",
  lessons: ["lesson-1"],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

const validLessonInput = {
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  type: "text",
  position: 1,
  reward: { coins: 0 },
  duration: 0,
  videoURL: "",
  azkar: [],
  questions: [],
  isLocked: false,
  isPublished: false,
};

const validPath = { ok: true, value: undefined } as const;
const notFoundPath = {
  ok: false,
  error: { code: "not-found" as const, message: "Module not found." },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listLessonsService", () => {
  it("propagates a not-found module path error", async () => {
    getModuleByIdServiceMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "not-found", message: "Module not found." },
    });

    const result = await listLessonsService("book-1", "module-1");

    expect(result.ok).toBe(false);
    expect(listLessonsByIdsMock).not.toHaveBeenCalled();
  });

  it("lists lessons in Module.lessons order", async () => {
    getModuleByIdServiceMock.mockResolvedValueOnce({
      ok: true,
      value: validModule,
    });
    listLessonsByIdsMock.mockResolvedValueOnce([validLesson]);

    const result = await listLessonsService("book-1", "module-1");

    expect(listLessonsByIdsMock).toHaveBeenCalledWith("book-1", "module-1", [
      "lesson-1",
    ]);
    expect(result).toEqual({ ok: true, value: [validLesson] });
  });
});

describe("createLessonService", () => {
  it("returns the module path error before parsing the body", async () => {
    validateModulePathMock.mockResolvedValueOnce(notFoundPath);

    const result = await createLessonService(
      "book-1",
      "module-1",
      {},
      "a@example.com",
    );

    expect(result.ok).toBe(false);
    expect(createLessonInRepoMock).not.toHaveBeenCalled();
  });

  it("does not call allQuestionsExist when questions is empty", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    createLessonInRepoMock.mockResolvedValueOnce(validLesson);

    await createLessonService(
      "book-1",
      "module-1",
      validLessonInput,
      "a@example.com",
    );

    expect(allQuestionsExistMock).not.toHaveBeenCalled();
    expect(createLessonInRepoMock).toHaveBeenCalled();
  });

  it("rejects when a referenced question doesn't exist under the same module", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    allQuestionsExistMock.mockResolvedValueOnce(false);

    const result = await createLessonService(
      "book-1",
      "module-1",
      { ...validLessonInput, questions: ["question-x"] },
      "a@example.com",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(createLessonInRepoMock).not.toHaveBeenCalled();
  });

  it("creates the lesson when all referenced questions exist", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    allQuestionsExistMock.mockResolvedValueOnce(true);
    createLessonInRepoMock.mockResolvedValueOnce(validLesson);

    const result = await createLessonService(
      "book-1",
      "module-1",
      { ...validLessonInput, questions: ["question-1"] },
      "a@example.com",
    );

    expect(allQuestionsExistMock).toHaveBeenCalledWith("book-1", "module-1", [
      "question-1",
    ]);
    expect(result).toEqual({ ok: true, value: validLesson });
  });
});

describe("getLessonByIdService", () => {
  it("rejects an invalid id without checking the module path", async () => {
    const result = await getLessonByIdService("book-1", "module-1", "a/b");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(validateModulePathMock).not.toHaveBeenCalled();
  });
});

describe("updateLessonService", () => {
  it("rejects an update whose questions reference a foreign/missing question", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    allQuestionsExistMock.mockResolvedValueOnce(false);

    const result = await updateLessonService(
      "book-1",
      "module-1",
      "lesson-1",
      { questions: ["question-x"] },
      "a@example.com",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(updateLessonByIdMock).not.toHaveBeenCalled();
  });

  it("updates position as a plain field", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    updateLessonByIdMock.mockResolvedValueOnce({ ...validLesson, position: 9 });

    const result = await updateLessonService(
      "book-1",
      "module-1",
      "lesson-1",
      { position: 9 },
      "a@example.com",
    );

    expect(updateLessonByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { position: 9 } }),
    );
    expect(result).toEqual({
      ok: true,
      value: { ...validLesson, position: 9 },
    });
  });
});

describe("deleteLessonService", () => {
  it("never returns a conflict -- Lesson delete has no dependency check", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    deleteLessonByIdMock.mockResolvedValueOnce(true);

    const result = await deleteLessonService("book-1", "module-1", "lesson-1");

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns not-found when the lesson doesn't exist", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    deleteLessonByIdMock.mockResolvedValueOnce(false);

    const result = await deleteLessonService("book-1", "module-1", "lesson-1");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "not-found" }),
    });
  });
});
