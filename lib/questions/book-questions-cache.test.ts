import { beforeEach, describe, expect, it } from "vitest";

import {
  addQuestionToBookCache,
  getCachedBookQuestions,
  removeQuestionFromBookCache,
  setCachedBookQuestions,
  updateQuestionInBookCache,
} from "./book-questions-cache";
import type { Question } from "./types";

function question(id: string): Question {
  return {
    id,
    text: { ar: "أ", en: "a" },
    explanation: { ar: "أ", en: "a" },
    choices: [{ text: { ar: "أ", en: "a" }, isCorrect: true }],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
  };
}

// The cache is a shared module-level Map, so every test uses its own bookId
// to stay isolated from the others.
let bookId: string;
let counter = 0;

beforeEach(() => {
  counter += 1;
  bookId = `book-${counter}`;
});

describe("getCachedBookQuestions / setCachedBookQuestions", () => {
  it("returns undefined for a book that hasn't been cached", () => {
    expect(getCachedBookQuestions(bookId)).toBeUndefined();
  });

  it("returns exactly what was set", () => {
    const groups = [{ moduleId: "module-1", questions: [question("q1")] }];

    setCachedBookQuestions(bookId, groups);

    expect(getCachedBookQuestions(bookId)).toBe(groups);
  });
});

describe("addQuestionToBookCache", () => {
  it("is a no-op when the book isn't cached", () => {
    addQuestionToBookCache(bookId, "module-1", question("q1"));

    expect(getCachedBookQuestions(bookId)).toBeUndefined();
  });

  it("appends to an existing module group", () => {
    setCachedBookQuestions(bookId, [
      { moduleId: "module-1", questions: [question("q1")] },
    ]);

    addQuestionToBookCache(bookId, "module-1", question("q2"));

    expect(getCachedBookQuestions(bookId)).toEqual([
      { moduleId: "module-1", questions: [question("q1"), question("q2")] },
    ]);
  });

  it("creates a new module group if the module isn't cached yet", () => {
    setCachedBookQuestions(bookId, [{ moduleId: "module-1", questions: [] }]);

    addQuestionToBookCache(bookId, "module-2", question("q1"));

    expect(getCachedBookQuestions(bookId)).toEqual([
      { moduleId: "module-1", questions: [] },
      { moduleId: "module-2", questions: [question("q1")] },
    ]);
  });
});

describe("updateQuestionInBookCache", () => {
  it("is a no-op when the book isn't cached", () => {
    updateQuestionInBookCache(bookId, "module-1", question("q1"));

    expect(getCachedBookQuestions(bookId)).toBeUndefined();
  });

  it("updates the question in place when its module hasn't changed", () => {
    setCachedBookQuestions(bookId, [
      { moduleId: "module-1", questions: [question("q1")] },
    ]);

    const edited = { ...question("q1"), explanation: { ar: "ب", en: "b" } };
    updateQuestionInBookCache(bookId, "module-1", edited);

    expect(getCachedBookQuestions(bookId)).toEqual([
      { moduleId: "module-1", questions: [edited] },
    ]);
  });

  it("preserves the group's other Questions' order on an in-place edit", () => {
    setCachedBookQuestions(bookId, [
      {
        moduleId: "module-1",
        questions: [question("q1"), question("q2"), question("q3")],
      },
    ]);

    const edited = { ...question("q2"), explanation: { ar: "ب", en: "b" } };
    updateQuestionInBookCache(bookId, "module-1", edited);

    expect(getCachedBookQuestions(bookId)).toEqual([
      {
        moduleId: "module-1",
        questions: [question("q1"), edited, question("q3")],
      },
    ]);
  });

  it("moves the question into the new module's group when the module changes", () => {
    setCachedBookQuestions(bookId, [
      { moduleId: "module-1", questions: [question("q1"), question("q2")] },
      { moduleId: "module-2", questions: [question("q3")] },
    ]);

    updateQuestionInBookCache(bookId, "module-2", question("q1"));

    expect(getCachedBookQuestions(bookId)).toEqual([
      { moduleId: "module-1", questions: [question("q2")] },
      { moduleId: "module-2", questions: [question("q3"), question("q1")] },
    ]);
  });
});

describe("removeQuestionFromBookCache", () => {
  it("is a no-op when the book isn't cached", () => {
    removeQuestionFromBookCache(bookId, "module-1", "q1");

    expect(getCachedBookQuestions(bookId)).toBeUndefined();
  });

  it("removes the question from its module group", () => {
    setCachedBookQuestions(bookId, [
      { moduleId: "module-1", questions: [question("q1"), question("q2")] },
    ]);

    removeQuestionFromBookCache(bookId, "module-1", "q1");

    expect(getCachedBookQuestions(bookId)).toEqual([
      { moduleId: "module-1", questions: [question("q2")] },
    ]);
  });

  it("is a no-op when the question isn't in the module's group", () => {
    setCachedBookQuestions(bookId, [
      { moduleId: "module-1", questions: [question("q1")] },
    ]);

    removeQuestionFromBookCache(bookId, "module-1", "missing");

    expect(getCachedBookQuestions(bookId)).toEqual([
      { moduleId: "module-1", questions: [question("q1")] },
    ]);
  });
});
