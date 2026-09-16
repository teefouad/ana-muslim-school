import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionGetMock,
  transactionSetMock,
  transactionUpdateMock,
  transactionDeleteMock,
  runTransactionMock,
  docMock,
  docGetMock,
  docUpdateMock,
  collectionMock,
  getAllMock,
  whereMock,
  whereLimitMock,
  whereGetMock,
  batchDeleteMock,
  batchMock,
  subcollectionGetMock,
} = vi.hoisted(() => {
  const transactionGetMock = vi.fn();
  const transactionSetMock = vi.fn();
  const transactionUpdateMock = vi.fn();
  const transactionDeleteMock = vi.fn();
  const runTransactionMock = vi.fn();
  const docMock = vi.fn();
  const docGetMock = vi.fn();
  const docUpdateMock = vi.fn();
  const collectionMock = vi.fn();
  const getAllMock = vi.fn();
  const whereMock = vi.fn();
  const whereLimitMock = vi.fn();
  const whereGetMock = vi.fn();
  const batchDeleteMock = vi.fn();
  const batchCommitMock = vi.fn();
  const batchMock = vi.fn(() => ({
    delete: batchDeleteMock,
    commit: batchCommitMock,
  }));
  const subcollectionGetMock = vi.fn();

  return {
    transactionGetMock,
    transactionSetMock,
    transactionUpdateMock,
    transactionDeleteMock,
    runTransactionMock,
    docMock,
    docGetMock,
    docUpdateMock,
    collectionMock,
    getAllMock,
    whereMock,
    whereLimitMock,
    whereGetMock,
    batchDeleteMock,
    batchCommitMock,
    batchMock,
    subcollectionGetMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
    getAll: getAllMock,
    batch: batchMock,
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
    arrayRemove: (...values: unknown[]) => ({ __arrayRemove: values }),
  },
}));

const {
  createLesson,
  getLessonById,
  listLessonsByIds,
  updateLessonById,
  deleteLessonById,
  deleteAllLessonsForModule,
  isQuestionReferencedByAnyLesson,
} = await import("./lessons-repository");

const validLessonData = {
  title: { ar: "أ", en: "a" },
  description: { ar: "أ", en: "a" },
  type: "text",
  position: 3,
  reward: { coins: 10 },
  content: { ar: "محتوى", en: "content" },
  duration: 60,
  videoURL: "",
  azkar: [],
  questions: [],
  isLocked: false,
  isPublished: false,
  createdBy: "admin@example.com",
  updatedBy: "admin@example.com",
};

function lessonsCollectionRef() {
  return {
    doc: docMock,
    where: whereMock,
    get: subcollectionGetMock,
  };
}

function moduleDocRef() {
  return {
    id: "module-1",
    collection: vi.fn(() => lessonsCollectionRef()),
  };
}

function setUpFirestoreMocks() {
  whereMock.mockReturnValue({ limit: whereLimitMock, get: whereGetMock });
  whereLimitMock.mockReturnValue({ get: whereGetMock });

  docMock.mockImplementation((id?: string) => ({
    id: id ?? "lesson-1",
    get: docGetMock,
    update: docUpdateMock,
  }));

  collectionMock.mockImplementation(() => ({
    doc: () => ({
      id: "book-1",
      collection: () => ({ doc: () => moduleDocRef() }),
    }),
  }));

  runTransactionMock.mockImplementation(async (fn) =>
    fn({
      get: transactionGetMock,
      set: transactionSetMock,
      update: transactionUpdateMock,
      delete: transactionDeleteMock,
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setUpFirestoreMocks();
});

describe("createLesson", () => {
  it("returns null without writing when the parent Module doesn't exist", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: false });

    const result = await createLesson(
      "book-1",
      "module-1",
      { ...validLessonData, type: "text" } as never,
      "admin@example.com",
    );

    expect(result).toBeNull();
    expect(transactionSetMock).not.toHaveBeenCalled();
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });

  it("sets the lesson doc and appends its id to Module.lessons in the same transaction", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: true });
    docGetMock.mockResolvedValueOnce({
      exists: true,
      id: "lesson-1",
      data: () => validLessonData,
    });

    await createLesson(
      "book-1",
      "module-1",
      validLessonData as never,
      "admin@example.com",
    );

    expect(transactionSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "lesson-1" }),
      expect.objectContaining({ position: 3, createdBy: "admin@example.com" }),
    );
    expect(transactionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "module-1" }),
      {
        lessons: { __arrayUnion: ["lesson-1"] },
        updatedAt: "SERVER_TIMESTAMP",
        updatedBy: "admin@example.com",
      },
    );
  });
});

describe("getLessonById", () => {
  it("returns null when missing", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });
    expect(await getLessonById("book-1", "module-1", "lesson-1")).toBeNull();
  });
});

describe("listLessonsByIds", () => {
  it("returns lessons in the exact given order", async () => {
    getAllMock.mockResolvedValueOnce([
      { exists: true, id: "l2", data: () => validLessonData },
      { exists: true, id: "l1", data: () => validLessonData },
    ]);

    const result = await listLessonsByIds("book-1", "module-1", ["l2", "l1"]);

    expect(result.map((l) => l.id)).toEqual(["l2", "l1"]);
  });

  it("returns an empty array without calling getAll for an empty id list", async () => {
    expect(await listLessonsByIds("book-1", "module-1", [])).toEqual([]);
    expect(getAllMock).not.toHaveBeenCalled();
  });

  it("defaults `content` to empty strings for a Lesson written before that field existed", async () => {
    const dataWithoutContent: Record<string, unknown> = { ...validLessonData };
    delete dataWithoutContent.content;
    getAllMock.mockResolvedValueOnce([
      { exists: true, id: "l1", data: () => dataWithoutContent },
    ]);

    const result = await listLessonsByIds("book-1", "module-1", ["l1"]);

    expect(result[0].content).toEqual({ ar: "", en: "" });
  });
});

describe("updateLessonById", () => {
  it("returns null without writing when the lesson doesn't exist", async () => {
    docGetMock.mockResolvedValueOnce({ exists: false });

    const result = await updateLessonById({
      bookId: "book-1",
      moduleId: "module-1",
      lessonId: "lesson-1",
      fields: { position: 5 },
      actorEmail: "admin@example.com",
    });

    expect(result).toBeNull();
    expect(docUpdateMock).not.toHaveBeenCalled();
  });

  it("passes `position` straight through as a plain field with no recomputation", async () => {
    docGetMock.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({
      exists: true,
      id: "lesson-1",
      data: () => ({ ...validLessonData, position: 42 }),
    });

    await updateLessonById({
      bookId: "book-1",
      moduleId: "module-1",
      lessonId: "lesson-1",
      fields: { position: 42 },
      actorEmail: "admin@example.com",
    });

    expect(docUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ position: 42 }),
    );
  });
});

describe("deleteLessonById", () => {
  it("returns false without writing when the lesson doesn't exist", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: false });

    const result = await deleteLessonById(
      "book-1",
      "module-1",
      "lesson-1",
      "admin@example.com",
    );

    expect(result).toBe(false);
    expect(transactionDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the lesson doc and removes its id from Module.lessons in the same transaction, refreshing the Module's audit fields", async () => {
    transactionGetMock.mockResolvedValueOnce({ exists: true });

    const result = await deleteLessonById(
      "book-1",
      "module-1",
      "lesson-1",
      "admin@example.com",
    );

    expect(result).toBe(true);
    expect(transactionDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "lesson-1" }),
    );
    expect(transactionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "module-1" }),
      {
        lessons: { __arrayRemove: ["lesson-1"] },
        updatedAt: "SERVER_TIMESTAMP",
        updatedBy: "admin@example.com",
      },
    );
  });
});

describe("deleteAllLessonsForModule", () => {
  it("bulk-deletes every lesson doc without touching the Module document", async () => {
    subcollectionGetMock.mockResolvedValueOnce({
      docs: [{ ref: { id: "l1" } }, { ref: { id: "l2" } }],
    });

    await deleteAllLessonsForModule("book-1", "module-1");

    expect(batchDeleteMock).toHaveBeenCalledTimes(2);
    expect(transactionUpdateMock).not.toHaveBeenCalled();
  });
});

describe("isQuestionReferencedByAnyLesson", () => {
  it("queries with an array-contains filter on questions", async () => {
    whereGetMock.mockResolvedValueOnce({ empty: false });

    const result = await isQuestionReferencedByAnyLesson(
      "book-1",
      "module-1",
      "question-1",
    );

    expect(whereMock).toHaveBeenCalledWith(
      "questions",
      "array-contains",
      "question-1",
    );
    expect(result).toBe(true);
  });

  it("returns false when no lesson references the question", async () => {
    whereGetMock.mockResolvedValueOnce({ empty: true });

    expect(
      await isQuestionReferencedByAnyLesson("book-1", "module-1", "question-1"),
    ).toBe(false);
  });
});
