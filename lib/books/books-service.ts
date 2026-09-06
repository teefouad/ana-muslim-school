import "server-only";

import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { deleteAllLessonsForModule } from "@/lib/lessons/lessons-repository";
import { deleteAllMaterialsForBook } from "@/lib/materials/materials-repository";
import { deleteModulesByIds } from "@/lib/modules/modules-repository";
import { deleteAllQuestionsForModule } from "@/lib/questions/questions-repository";
import { deleteAllSourcesForBook } from "@/lib/sources/sources-repository";
import {
  bookExists as bookExistsInRepo,
  createBook as createBookInRepo,
  deleteBookDocument,
  getBookById as getBookByIdFromRepo,
  listBooks as listBooksFromRepo,
  updateBookById,
} from "./books-repository";
import type { Book } from "./types";
import { parseBookCreateInput, parseBookPatchInput } from "./validation";

export async function listBooksService(): Promise<Book[]> {
  return listBooksFromRepo();
}

export async function bookExists(id: string): Promise<boolean> {
  return bookExistsInRepo(id);
}

export async function createBookService(
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Book>> {
  const parsed = parseBookCreateInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const book = await createBookInRepo(parsed.value, actorEmail);

  return ok(book);
}

export async function getBookByIdService(
  id: string,
): Promise<ServiceResult<Book>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid book id.");
  }

  const book = await getBookByIdFromRepo(id);

  return book ? ok(book) : fail("not-found", "Book not found.");
}

export async function updateBookService(
  id: string,
  body: Record<string, unknown>,
  actorEmail: string,
): Promise<ServiceResult<Book>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid book id.");
  }

  const parsed = parseBookPatchInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const { modulesReorder, ...fields } = parsed.value;

  const updated = await updateBookById({
    id,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    modulesReorder,
    actorEmail,
  });

  if (updated === "invalid-reorder") {
    return fail(
      "invalid-input",
      "`modules` must be a reorder of the exact current set of module ids.",
    );
  }

  return updated ? ok(updated) : fail("not-found", "Book not found.");
}

/**
 * Deletes a Book and cascades to every Module/Lesson/Question under it and
 * every root Source/Material whose `bookId` matches it, per ANA-62.
 * Dependent documents are removed before the Book document itself; this is
 * an explicit, always-cascading delete -- it never fails with `409` just
 * because the Book still has content.
 */
export async function deleteBookService(
  id: string,
): Promise<ServiceResult<void>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid book id.");
  }

  const book = await getBookByIdFromRepo(id);

  if (!book) {
    return fail("not-found", "Book not found.");
  }

  // Every deletion below targets an independent Firestore path (a
  // subcollection doc addressed directly, or a root-collection query), so
  // none of them depend on another completing first -- only the Book
  // document itself must be removed last, once every dependent document is
  // gone.
  await Promise.all([
    ...book.modules.flatMap((moduleId) => [
      deleteAllLessonsForModule(id, moduleId),
      deleteAllQuestionsForModule(id, moduleId),
    ]),
    book.modules.length > 0
      ? deleteModulesByIds(id, book.modules)
      : Promise.resolve(),
    deleteAllSourcesForBook(id),
    deleteAllMaterialsForBook(id),
  ]);

  await deleteBookDocument(id);

  return ok(undefined);
}
