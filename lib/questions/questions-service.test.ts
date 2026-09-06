import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateModulePathMock,
  isQuestionReferencedByAnyLessonMock,
  createQuestionInRepoMock,
  deleteQuestionByIdMock,
  getQuestionByIdFromRepoMock,
  listQuestionsFromRepoMock,
  updateQuestionByIdMock,
} = vi.hoisted(() => ({
  validateModulePathMock: vi.fn(),
  isQuestionReferencedByAnyLessonMock: vi.fn(),
  createQuestionInRepoMock: vi.fn(),
  deleteQuestionByIdMock: vi.fn(),
  getQuestionByIdFromRepoMock: vi.fn(),
  listQuestionsFromRepoMock: vi.fn(),
  updateQuestionByIdMock: vi.fn(),
}));

vi.mock("@/lib/modules/modules-service", () => ({
  validateModulePath: validateModulePathMock,
}));

vi.mock("@/lib/lessons/lessons-repository", () => ({
  isQuestionReferencedByAnyLesson: isQuestionReferencedByAnyLessonMock,
}));

vi.mock("./questions-repository", () => ({
  createQuestion: createQuestionInRepoMock,
  deleteQuestionById: deleteQuestionByIdMock,
  getQuestionById: getQuestionByIdFromRepoMock,
  listQuestions: listQuestionsFromRepoMock,
  updateQuestionById: updateQuestionByIdMock,
}));

const {
  createQuestionService,
  deleteQuestionService,
  getQuestionByIdService,
  listQuestionsService,
  updateQuestionService,
} = await import("./questions-service");

const validQuestion = {
  id: "question-1",
  text: { ar: "أ", en: "a" },
  explanation: { ar: "أ", en: "a" },
  choices: [{ text: { ar: "أ", en: "a" }, isCorrect: true }],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

const validPath = { ok: true, value: undefined } as const;
const notFoundPath = {
  ok: false,
  error: { code: "not-found" as const, message: "Module not found." },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listQuestionsService", () => {
  it("returns the path error when the Book/Module path is invalid", async () => {
    validateModulePathMock.mockResolvedValueOnce(notFoundPath);

    const result = await listQuestionsService("book-1", "module-1");

    expect(result).toEqual(notFoundPath);
    expect(listQuestionsFromRepoMock).not.toHaveBeenCalled();
  });

  it("lists questions once the module path is valid", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    listQuestionsFromRepoMock.mockResolvedValueOnce([validQuestion]);

    const result = await listQuestionsService("book-1", "module-1");

    expect(result).toEqual({ ok: true, value: [validQuestion] });
  });
});

describe("createQuestionService", () => {
  it("validates the module path before parsing the body", async () => {
    validateModulePathMock.mockResolvedValueOnce(notFoundPath);

    const result = await createQuestionService(
      "book-1",
      "module-1",
      {
        text: validQuestion.text,
        explanation: validQuestion.explanation,
        choices: validQuestion.choices,
      },
      "a@example.com",
    );

    expect(result.ok).toBe(false);
    expect(createQuestionInRepoMock).not.toHaveBeenCalled();
  });

  it("creates the question on valid input", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    createQuestionInRepoMock.mockResolvedValueOnce(validQuestion);

    const result = await createQuestionService(
      "book-1",
      "module-1",
      {
        text: validQuestion.text,
        explanation: validQuestion.explanation,
        choices: validQuestion.choices,
      },
      "a@example.com",
    );

    expect(result).toEqual({ ok: true, value: validQuestion });
  });
});

describe("getQuestionByIdService", () => {
  it("rejects an invalid question id without checking the module path", async () => {
    const result = await getQuestionByIdService("book-1", "module-1", "a/b");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(validateModulePathMock).not.toHaveBeenCalled();
  });
});

describe("updateQuestionService", () => {
  it("rejects an empty patch body without touching the repository", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);

    const result = await updateQuestionService(
      "book-1",
      "module-1",
      "question-1",
      {},
      "a@example.com",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-input" }),
    });
    expect(updateQuestionByIdMock).not.toHaveBeenCalled();
  });

  it("updates only the supplied fields and returns not-found when the question is missing", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    updateQuestionByIdMock.mockResolvedValueOnce(null);

    const result = await updateQuestionService(
      "book-1",
      "module-1",
      "question-1",
      { explanation: validQuestion.explanation },
      "a@example.com",
    );

    expect(updateQuestionByIdMock).toHaveBeenCalledWith({
      bookId: "book-1",
      moduleId: "module-1",
      questionId: "question-1",
      fields: { explanation: validQuestion.explanation },
      actorEmail: "a@example.com",
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "not-found" }),
    });
  });

  it("returns the updated Question on success", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    updateQuestionByIdMock.mockResolvedValueOnce(validQuestion);

    const result = await updateQuestionService(
      "book-1",
      "module-1",
      "question-1",
      { text: validQuestion.text },
      "a@example.com",
    );

    expect(result).toEqual({ ok: true, value: validQuestion });
  });
});

describe("deleteQuestionService", () => {
  it("returns conflict when a Lesson still references the question", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    isQuestionReferencedByAnyLessonMock.mockResolvedValueOnce(true);

    const result = await deleteQuestionService(
      "book-1",
      "module-1",
      "question-1",
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "conflict" }),
    });
    expect(deleteQuestionByIdMock).not.toHaveBeenCalled();
  });

  it("deletes the question when no Lesson references it", async () => {
    validateModulePathMock.mockResolvedValueOnce(validPath);
    isQuestionReferencedByAnyLessonMock.mockResolvedValueOnce(false);
    deleteQuestionByIdMock.mockResolvedValueOnce(true);

    const result = await deleteQuestionService(
      "book-1",
      "module-1",
      "question-1",
    );

    expect(deleteQuestionByIdMock).toHaveBeenCalledWith(
      "book-1",
      "module-1",
      "question-1",
    );
    expect(result).toEqual({ ok: true, value: undefined });
  });
});
