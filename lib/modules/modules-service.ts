import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { anyMaterialReferencesModule } from "@/lib/materials/materials-repository";
import { anyQuestionExists } from "@/lib/questions/questions-repository";
import {
  createModule as createModuleInRepo,
  deleteModuleById,
  getModuleById as getModuleByIdFromRepo,
  listModulesByIds,
  moduleExists as moduleExistsInRepo,
  updateModuleById,
} from "./modules-repository";
import type { Module } from "./types";
import { parseModuleCreateInput, parseModulePatchInput } from "./validation";

export async function moduleExists(
  bookId: string,
  moduleId: string,
): Promise<boolean> {
  return moduleExistsInRepo(bookId, moduleId);
}

/**
 * Verifies the `bookId`/`moduleId` path resolves to a real Book and Module,
 * in that order. Shared by every resource nested under a Module (Lessons,
 * Questions) so "book vs module not found" is reported consistently in one
 * place instead of being re-implemented per resource (see ANA-62).
 */
export async function validateModulePath(
  bookId: string,
  moduleId: string,
): Promise<ServiceResult<void>> {
  const moduleResult = await getModuleByIdService(bookId, moduleId);

  return moduleResult.ok
    ? ok(undefined)
    : fail(moduleResult.error.code, moduleResult.error.message);
}

export async function listModulesService(
  bookId: string,
): Promise<ServiceResult<Module[]>> {
  const book = await getBookByIdService(bookId);

  if (!book.ok) {
    return fail("not-found", "Book not found.");
  }

  return ok(await listModulesByIds(bookId, book.value.modules));
}

export async function createModuleService(
  bookId: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Module>> {
  const book = await getBookByIdService(bookId);

  if (!book.ok) {
    return fail("not-found", "Book not found.");
  }

  const parsed = parseModuleCreateInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const created = await createModuleInRepo(bookId, parsed.value, actorEmail);

  if (!created) {
    return fail("not-found", "Book not found.");
  }

  return ok(created);
}

export async function getModuleByIdService(
  bookId: string,
  moduleId: string,
): Promise<ServiceResult<Module>> {
  if (!isValidDocId(bookId) || !isValidDocId(moduleId)) {
    return fail("invalid-input", "Invalid book or module id.");
  }

  const book = await getBookByIdService(bookId);

  if (!book.ok) {
    return fail("not-found", "Book not found.");
  }

  const found = await getModuleByIdFromRepo(bookId, moduleId);

  return found ? ok(found) : fail("not-found", "Module not found.");
}

export async function updateModuleService(
  bookId: string,
  moduleId: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Module>> {
  if (!isValidDocId(bookId) || !isValidDocId(moduleId)) {
    return fail("invalid-input", "Invalid book or module id.");
  }

  const book = await getBookByIdService(bookId);

  if (!book.ok) {
    return fail("not-found", "Book not found.");
  }

  const parsed = parseModulePatchInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const { lessonsReorder, ...fields } = parsed.value;

  const updated = await updateModuleById({
    bookId,
    moduleId,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    lessonsReorder,
    actorEmail,
  });

  if (updated === "invalid-reorder") {
    return fail(
      "invalid-input",
      "`lessons` must be a reorder of the exact current set of lesson ids.",
    );
  }

  return updated ? ok(updated) : fail("not-found", "Module not found.");
}

/**
 * Deletes a Module. Fails with `409` if it still has Lessons, Questions, or
 * Materials referencing it -- unlike Book delete, Module delete never
 * cascades (see ANA-62).
 */
export async function deleteModuleService(
  bookId: string,
  moduleId: string,
  actorEmail: string,
): Promise<ServiceResult<void>> {
  if (!isValidDocId(bookId) || !isValidDocId(moduleId)) {
    return fail("invalid-input", "Invalid book or module id.");
  }

  const book = await getBookByIdService(bookId);

  if (!book.ok) {
    return fail("not-found", "Book not found.");
  }

  const current = await getModuleByIdFromRepo(bookId, moduleId);

  if (!current) {
    return fail("not-found", "Module not found.");
  }

  if (current.lessons.length > 0) {
    return fail("conflict", "Module still has Lessons.");
  }

  if (await anyQuestionExists(bookId, moduleId)) {
    return fail("conflict", "Module still has Questions.");
  }

  if (await anyMaterialReferencesModule(bookId, moduleId)) {
    return fail("conflict", "Module still has Materials referencing it.");
  }

  const deleted = await deleteModuleById(bookId, moduleId, actorEmail);

  return deleted ? ok(undefined) : fail("not-found", "Module not found.");
}
