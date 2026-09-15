import "server-only";

import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { isQuestionReferencedByAnyLesson } from "@/lib/lessons/lessons-repository";
import { validateModulePath } from "@/lib/modules/modules-service";
import {
  addQuestionToBookCache,
  removeQuestionFromBookCache,
  updateQuestionInBookCache,
} from "./book-questions-cache";
import {
  createQuestion as createQuestionInRepo,
  deleteQuestionById,
  getQuestionById as getQuestionByIdFromRepo,
  listQuestions as listQuestionsFromRepo,
  updateQuestionById,
} from "./questions-repository";
import type { Question } from "./types";
import {
  parseQuestionCreateInput,
  parseQuestionPatchInput,
} from "./validation";

export async function listQuestionsService(
  bookId: string,
  moduleId: string,
): Promise<ServiceResult<Question[]>> {
  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  return ok(await listQuestionsFromRepo(bookId, moduleId));
}

export async function createQuestionService(
  bookId: string,
  moduleId: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Question>> {
  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const parsed = parseQuestionCreateInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const question = await createQuestionInRepo(
    bookId,
    moduleId,
    parsed.value,
    actorEmail,
  );

  addQuestionToBookCache(bookId, moduleId, question);

  return ok(question);
}

export async function getQuestionByIdService(
  bookId: string,
  moduleId: string,
  questionId: string,
): Promise<ServiceResult<Question>> {
  if (!isValidDocId(questionId)) {
    return fail("invalid-input", "Invalid question id.");
  }

  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const question = await getQuestionByIdFromRepo(bookId, moduleId, questionId);

  return question ? ok(question) : fail("not-found", "Question not found.");
}

export async function updateQuestionService(
  bookId: string,
  moduleId: string,
  questionId: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Question>> {
  if (!isValidDocId(questionId)) {
    return fail("invalid-input", "Invalid question id.");
  }

  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const parsed = parseQuestionPatchInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const updated = await updateQuestionById({
    bookId,
    moduleId,
    questionId,
    fields: parsed.value,
    actorEmail,
  });

  if (!updated) {
    return fail("not-found", "Question not found.");
  }

  updateQuestionInBookCache(bookId, moduleId, updated);

  return ok(updated);
}

/** Fails with `409` while any Lesson in the Module still references this Question (see ANA-62). */
export async function deleteQuestionService(
  bookId: string,
  moduleId: string,
  questionId: string,
): Promise<ServiceResult<void>> {
  if (!isValidDocId(questionId)) {
    return fail("invalid-input", "Invalid question id.");
  }

  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  if (await isQuestionReferencedByAnyLesson(bookId, moduleId, questionId)) {
    return fail("conflict", "Question is still referenced by a Lesson.");
  }

  const deleted = await deleteQuestionById(bookId, moduleId, questionId);

  if (!deleted) {
    return fail("not-found", "Question not found.");
  }

  removeQuestionFromBookCache(bookId, moduleId, questionId);

  return ok(undefined);
}
