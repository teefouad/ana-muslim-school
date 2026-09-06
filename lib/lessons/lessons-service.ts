import "server-only";

import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import {
  getModuleByIdService,
  validateModulePath,
} from "@/lib/modules/modules-service";
import { allQuestionsExist } from "@/lib/questions/questions-repository";
import {
  createLesson as createLessonInRepo,
  deleteLessonById,
  getLessonById as getLessonByIdFromRepo,
  listLessonsByIds,
  updateLessonById,
} from "./lessons-repository";
import type { Lesson } from "./types";
import { parseLessonCreateInput, parseLessonPatchInput } from "./validation";

export async function listLessonsService(
  bookId: string,
  moduleId: string,
): Promise<ServiceResult<Lesson[]>> {
  const moduleResult = await getModuleByIdService(bookId, moduleId);

  if (!moduleResult.ok) {
    return fail(moduleResult.error.code, moduleResult.error.message);
  }

  return ok(
    await listLessonsByIds(bookId, moduleId, moduleResult.value.lessons),
  );
}

export async function createLessonService(
  bookId: string,
  moduleId: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Lesson>> {
  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const parsed = parseLessonCreateInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  if (
    parsed.value.questions.length > 0 &&
    !(await allQuestionsExist(bookId, moduleId, parsed.value.questions))
  ) {
    return fail(
      "invalid-input",
      "`questions` must only reference existing Questions from the same Module.",
    );
  }

  const created = await createLessonInRepo(
    bookId,
    moduleId,
    parsed.value,
    actorEmail,
  );

  if (!created) {
    return fail("not-found", "Module not found.");
  }

  return ok(created);
}

export async function getLessonByIdService(
  bookId: string,
  moduleId: string,
  lessonId: string,
): Promise<ServiceResult<Lesson>> {
  if (
    !isValidDocId(bookId) ||
    !isValidDocId(moduleId) ||
    !isValidDocId(lessonId)
  ) {
    return fail("invalid-input", "Invalid book, module, or lesson id.");
  }

  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const lesson = await getLessonByIdFromRepo(bookId, moduleId, lessonId);

  return lesson ? ok(lesson) : fail("not-found", "Lesson not found.");
}

export async function updateLessonService(
  bookId: string,
  moduleId: string,
  lessonId: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Lesson>> {
  if (
    !isValidDocId(bookId) ||
    !isValidDocId(moduleId) ||
    !isValidDocId(lessonId)
  ) {
    return fail("invalid-input", "Invalid book, module, or lesson id.");
  }

  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const parsed = parseLessonPatchInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  if (
    parsed.value.questions !== undefined &&
    parsed.value.questions.length > 0 &&
    !(await allQuestionsExist(bookId, moduleId, parsed.value.questions))
  ) {
    return fail(
      "invalid-input",
      "`questions` must only reference existing Questions from the same Module.",
    );
  }

  const updated = await updateLessonById({
    bookId,
    moduleId,
    lessonId,
    fields: parsed.value,
    actorEmail,
  });

  return updated ? ok(updated) : fail("not-found", "Lesson not found.");
}

/** Removes the Lesson from `Module.lessons`; referenced Question documents are untouched (see ANA-62). */
export async function deleteLessonService(
  bookId: string,
  moduleId: string,
  lessonId: string,
): Promise<ServiceResult<void>> {
  if (
    !isValidDocId(bookId) ||
    !isValidDocId(moduleId) ||
    !isValidDocId(lessonId)
  ) {
    return fail("invalid-input", "Invalid book, module, or lesson id.");
  }

  const pathResult = await validateModulePath(bookId, moduleId);

  if (!pathResult.ok) {
    return pathResult;
  }

  const deleted = await deleteLessonById(bookId, moduleId, lessonId);

  return deleted ? ok(undefined) : fail("not-found", "Lesson not found.");
}
