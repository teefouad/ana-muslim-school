import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  docMock,
  docGetMock,
  docUpdateMock,
  docDeleteMock,
  collectionMock,
  getAllMock,
  subcollectionGetMock,
  limitMock,
  limitGetMock,
  batchDeleteMock,
  batchCommitMock,
  batchMock,
} = vi.hoisted(() => {
  const docMock = vi.fn();
  const docGetMock = vi.fn();
  const docUpdateMock = vi.fn();
  const docDeleteMock = vi.fn();
  const collectionMock = vi.fn();
  const getAllMock = vi.fn();
  const subcollectionGetMock = vi.fn();
  const limitMock = vi.fn();
  const limitGetMock = vi.fn();
  const batchDeleteMock = vi.fn();
  const batchCommitMock = vi.fn();
  const batchMock = vi.fn(() => ({
    delete: batchDeleteMock,
    commit: batchCommitMock,
  }));

  return {
    docMock,
    docGetMock,
    docUpdateMock,
    docDeleteMock,
    collectionMock,
    getAllMock,
    subcollectionGetMock,
    limitMock,
    limitGetMock,
    batchDeleteMock,
    batchCommitMock,
    batchMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: collectionMock,
    getAll: getAllMock,
    batch: batchMock,
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

const {
  createQuestion,
  getQuestionById,
  questionExists,
  allQuestionsExist,
  anyQuestionExists,
  listQuestions,
  updateQuestionById,
  deleteQuestionById,
  deleteAllQuestionsForModule,
} = await import("./questions-repository");

const validQuestionData = {
  text: { ar: "أ", en: "a" },
  explanation: { ar: "أ", en: "a" },
  choices: [{ text: { ar: "أ", en: "a" }, isCorrect: true }],
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

function questionsCollectionRef() {
  return {
    doc: docMock,
    get: subcollectionGetMock,
    limit: limitMock,
  };
}

function setUpFirestoreMocks() {
  limitMock.mockReturnValue({ get: limitGetMock });

  docMock.mockImplementation((id?: string) => ({
    id: id ?? "question-1",
    get: docGetMock,
    set: vi.fn().mockResolvedValue(undefined),
    update: docUpdateMock,
    delete: docDeleteMock,
  }));

  collectionMock.mockImplementation(() => ({
    doc: () => ({
      id: "book-1",
      collection: () => ({
        doc: () => ({
          id: "module-1",
          collection: () => questionsCollectionRef(),
        }),
      }),
    }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  setUpFirestoreMocks();
});

describe("createQuestion", () => {
  it("sets the question doc with server timestamps and reads it back", async () => {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "question-1",
      data: () => validQuestionData,
    });

    const question = await createQuestion(
      "book-1",
      "module-1",
      {
        text: validQuestionData.text,
        explanation: validQuestionData.explanation,
        choices: validQuestionData.choices,
      },
      "admin@example.com",
    );

    expect(question).toMatchObject({ id: "question-1" });
  });
});

describe("getQuestionById / questionExists", () => {
  it("returns null/false when missing", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });
    expect(
      await getQuestionById("book-1", "module-1", "question-1"),
    ).toBeNull();

    docGetMock.mockResolvedValueOnce({ exists: false });
    expect(await questionExists("book-1", "module-1", "question-1")).toBe(
      false,
    );
  });
});

describe("allQuestionsExist", () => {
  it("returns true for an empty list without calling getAll", async () => {
    expect(await allQuestionsExist("book-1", "module-1", [])).toBe(true);
    expect(getAllMock).not.toHaveBeenCalled();
  });

  it("returns false when any given id is missing", async () => {
    getAllMock.mockResolvedValueOnce([{ exists: true }, { exists: false }]);

    expect(await allQuestionsExist("book-1", "module-1", ["q1", "q2"])).toBe(
      false,
    );
  });

  it("returns true when every given id exists", async () => {
    getAllMock.mockResolvedValueOnce([{ exists: true }, { exists: true }]);

    expect(await allQuestionsExist("book-1", "module-1", ["q1", "q2"])).toBe(
      true,
    );
  });
});

describe("anyQuestionExists", () => {
  it("queries with a limit(1)", async () => {
    limitGetMock.mockResolvedValueOnce({ empty: false });

    expect(await anyQuestionExists("book-1", "module-1")).toBe(true);
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it("returns false when no question exists", async () => {
    limitGetMock.mockResolvedValueOnce({ empty: true });
    expect(await anyQuestionExists("book-1", "module-1")).toBe(false);
  });
});

describe("listQuestions", () => {
  it("maps every doc in the subcollection", async () => {
    subcollectionGetMock.mockResolvedValueOnce({
      docs: [{ id: "q1", data: () => validQuestionData }],
    });

    const result = await listQuestions("book-1", "module-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("q1");
  });
});

describe("updateQuestionById", () => {
  it("returns null without writing when missing", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    const result = await updateQuestionById({
      bookId: "book-1",
      moduleId: "module-1",
      questionId: "question-1",
      fields: { text: validQuestionData.text },
      actorEmail: "admin@example.com",
    });

    expect(result).toBeNull();
    expect(docUpdateMock).not.toHaveBeenCalled();
  });
});

describe("deleteQuestionById", () => {
  it("returns false without deleting when missing", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    expect(await deleteQuestionById("book-1", "module-1", "question-1")).toBe(
      false,
    );
    expect(docDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the doc when it exists", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true });

    expect(await deleteQuestionById("book-1", "module-1", "question-1")).toBe(
      true,
    );
    expect(docDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteAllQuestionsForModule", () => {
  it("bulk-deletes every question doc", async () => {
    subcollectionGetMock.mockResolvedValueOnce({
      docs: [{ ref: { id: "q1" } }, { ref: { id: "q2" } }],
    });

    await deleteAllQuestionsForModule("book-1", "module-1");

    expect(batchDeleteMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });
});
