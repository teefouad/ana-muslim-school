import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { DocumentSnapshot, Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { timestampToDate } from "@/lib/firestore/timestamps";
import { isValidReorder } from "@/lib/learning-content/validate-reorder";
import {
  isValidBookDocument,
  type Book,
  type BookWritableFields,
} from "./types";

export const BOOKS_COLLECTION = "books";

function parseBookDocument(doc: DocumentSnapshot): Book | null {
  try {
    const data = doc.data();

    if (!data || !isValidBookDocument(data)) {
      return null;
    }

    return {
      id: doc.id,
      title: data.title,
      description: data.description,
      longDescription: data.longDescription,
      color: data.color,
      imageId: data.imageId,
      modules: data.modules,
      isLocked: data.isLocked,
      isPublished: data.isPublished,
      createdAt:
        timestampToDate(data.createdAt as Timestamp | undefined) ?? new Date(0),
      updatedAt:
        timestampToDate(data.updatedAt as Timestamp | undefined) ?? new Date(0),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  } catch {
    return null;
  }
}

/** Creates a Book document. `modules` is always server-initialized to `[]`, per ANA-62. */
export async function createBook(
  fields: BookWritableFields,
  actorEmail: string,
): Promise<Book> {
  const ref = getAdminFirestore().collection(BOOKS_COLLECTION).doc();

  await ref.set({
    ...fields,
    modules: [],
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actorEmail,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
  });

  const snapshot = await ref.get();
  const book = parseBookDocument(snapshot);

  if (!book) {
    throw new Error("Failed to read back the newly created Book document.");
  }

  return book;
}

export async function getBookById(id: string): Promise<Book | null> {
  const snapshot = await getAdminFirestore()
    .collection(BOOKS_COLLECTION)
    .doc(id)
    .get();

  return snapshot.exists ? parseBookDocument(snapshot) : null;
}

export async function bookExists(id: string): Promise<boolean> {
  const snapshot = await getAdminFirestore()
    .collection(BOOKS_COLLECTION)
    .doc(id)
    .get();

  return snapshot.exists;
}

export async function listBooks(): Promise<Book[]> {
  const snapshot = await getAdminFirestore().collection(BOOKS_COLLECTION).get();

  return snapshot.docs
    .map(parseBookDocument)
    .filter((book): book is Book => book !== null);
}

type UpdateBookByIdInput = {
  id: string;
  /** Omit (`undefined`) to leave the writable fields untouched. */
  fields?: Partial<BookWritableFields>;
  /** Omit (`undefined`) to leave `modules` untouched; present only for a validated reorder. */
  modulesReorder?: string[];
  actorEmail: string;
};

/**
 * Partially updates a Book document by id. Returns `null` without writing if
 * `id` doesn't match an existing document, so the caller can respond with a
 * 404 instead of silently creating Firestore's implicit empty document.
 *
 * When `modulesReorder` is given, the reorder is re-validated against the
 * *live* `modules` array inside a transaction, and only written if it's
 * still a valid permutation at write time -- this closes the race window
 * against a concurrent Module create/delete (which mutate `modules` via
 * `arrayUnion`/`arrayRemove`) that a separate read-then-write would otherwise
 * leave open. Returns `"invalid-reorder"` if the live array no longer
 * matches by the time the transaction runs.
 */
export async function updateBookById({
  id,
  fields,
  modulesReorder,
  actorEmail,
}: UpdateBookByIdInput): Promise<Book | null | "invalid-reorder"> {
  const ref = getAdminFirestore().collection(BOOKS_COLLECTION).doc(id);

  if (!modulesReorder) {
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    await ref.update({
      ...fields,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });

    return parseBookDocument(await ref.get());
  }

  const outcome = await getAdminFirestore().runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        return "not-found" as const;
      }

      const current = parseBookDocument(snapshot);

      if (!current || !isValidReorder(modulesReorder, current.modules)) {
        return "invalid-reorder" as const;
      }

      transaction.update(ref, {
        ...fields,
        modules: modulesReorder,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorEmail,
      });

      return "ok" as const;
    },
  );

  if (outcome !== "ok") {
    return outcome === "not-found" ? null : "invalid-reorder";
  }

  return parseBookDocument(await ref.get());
}

/**
 * Deletes only the Book document itself. Callers are responsible for first
 * removing every nested Module/Lesson/Question and every root Source/
 * Material associated with this Book -- see `deleteBookService` in
 * lib/books/books-service.ts, which orchestrates the full cascade.
 */
export async function deleteBookDocument(id: string): Promise<void> {
  await getAdminFirestore().collection(BOOKS_COLLECTION).doc(id).delete();
}
