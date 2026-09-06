import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { DocumentSnapshot, Timestamp } from "firebase-admin/firestore";

import { BOOKS_COLLECTION } from "@/lib/books/books-repository";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { deleteRefsInBatches } from "@/lib/firestore/delete-refs-in-batches";
import { timestampToDate } from "@/lib/firestore/timestamps";
import { isValidReorder } from "@/lib/learning-content/validate-reorder";
import {
  isValidModuleDocument,
  type Module,
  type ModuleWritableFields,
} from "./types";

export const MODULES_COLLECTION = "modules";

function modulesCollection(bookId: string) {
  return getAdminFirestore()
    .collection(BOOKS_COLLECTION)
    .doc(bookId)
    .collection(MODULES_COLLECTION);
}

function parseModuleDocument(doc: DocumentSnapshot): Module | null {
  try {
    const data = doc.data();

    if (!data || !isValidModuleDocument(data)) {
      return null;
    }

    return {
      id: doc.id,
      title: data.title,
      description: data.description,
      color: data.color,
      lessons: data.lessons,
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

/**
 * Creates a Module document under `bookId` and appends its id to the
 * parent's `Book.modules` array, atomically (see ANA-62). `lessons` is
 * always server-initialized to `[]`.
 *
 * Returns `null` if `bookId` doesn't match an existing Book, so the caller
 * can respond with a 404 rather than creating an orphaned Module.
 */
export async function createModule(
  bookId: string,
  fields: ModuleWritableFields,
  actorEmail: string,
): Promise<Module | null> {
  const firestore = getAdminFirestore();
  const bookRef = firestore.collection(BOOKS_COLLECTION).doc(bookId);
  const moduleRef = bookRef.collection(MODULES_COLLECTION).doc();

  const created = await firestore.runTransaction(async (transaction) => {
    const bookSnapshot = await transaction.get(bookRef);

    if (!bookSnapshot.exists) {
      return false;
    }

    transaction.set(moduleRef, {
      ...fields,
      lessons: [],
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actorEmail,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });
    transaction.update(bookRef, {
      modules: FieldValue.arrayUnion(moduleRef.id),
    });

    return true;
  });

  if (!created) {
    return null;
  }

  return parseModuleDocument(await moduleRef.get());
}

export async function getModuleById(
  bookId: string,
  moduleId: string,
): Promise<Module | null> {
  const snapshot = await modulesCollection(bookId).doc(moduleId).get();

  return snapshot.exists ? parseModuleDocument(snapshot) : null;
}

export async function moduleExists(
  bookId: string,
  moduleId: string,
): Promise<boolean> {
  const snapshot = await modulesCollection(bookId).doc(moduleId).get();

  return snapshot.exists;
}

/**
 * Lists Modules under `bookId` in the exact order given by `orderedIds`
 * (the parent `Book.modules` array -- see ANA-62). Uses `getAll` so the
 * reads are batched while still resolving in the requested order.
 */
export async function listModulesByIds(
  bookId: string,
  orderedIds: string[],
): Promise<Module[]> {
  if (orderedIds.length === 0) {
    return [];
  }

  const collection = modulesCollection(bookId);
  const snapshots = await getAdminFirestore().getAll(
    ...orderedIds.map((id) => collection.doc(id)),
  );

  return snapshots
    .map(parseModuleDocument)
    .filter((module): module is Module => module !== null);
}

type UpdateModuleByIdInput = {
  bookId: string;
  moduleId: string;
  /** Omit (`undefined`) to leave the writable fields untouched. */
  fields?: Partial<ModuleWritableFields>;
  /** Omit (`undefined`) to leave `lessons` untouched; present only for a validated reorder. */
  lessonsReorder?: string[];
  actorEmail: string;
};

/**
 * Partially updates a Module document by id. Returns `null` without writing
 * if `moduleId` doesn't match an existing document under `bookId`.
 *
 * When `lessonsReorder` is given, the reorder is re-validated against the
 * *live* `lessons` array inside a transaction, and only written if it's
 * still a valid permutation at write time -- this closes the race window
 * against a concurrent Lesson create/delete (which mutate `lessons` via
 * `arrayUnion`/`arrayRemove`) that a separate read-then-write would
 * otherwise leave open. Returns `"invalid-reorder"` if the live array no
 * longer matches by the time the transaction runs.
 */
export async function updateModuleById({
  bookId,
  moduleId,
  fields,
  lessonsReorder,
  actorEmail,
}: UpdateModuleByIdInput): Promise<Module | null | "invalid-reorder"> {
  const ref = modulesCollection(bookId).doc(moduleId);

  if (!lessonsReorder) {
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    await ref.update({
      ...fields,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });

    return parseModuleDocument(await ref.get());
  }

  const outcome = await getAdminFirestore().runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        return "not-found" as const;
      }

      const current = parseModuleDocument(snapshot);

      if (!current || !isValidReorder(lessonsReorder, current.lessons)) {
        return "invalid-reorder" as const;
      }

      transaction.update(ref, {
        ...fields,
        lessons: lessonsReorder,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorEmail,
      });

      return "ok" as const;
    },
  );

  if (outcome !== "ok") {
    return outcome === "not-found" ? null : "invalid-reorder";
  }

  return parseModuleDocument(await ref.get());
}

/**
 * Deletes a Module document and removes its id from the parent's
 * `Book.modules` array, atomically. Callers must already have verified the
 * Module has no Lessons/Questions/Materials referencing it -- see
 * `deleteModuleService` in lib/modules/modules-service.ts.
 *
 * Returns `false` without writing if `moduleId` doesn't match an existing
 * document under `bookId`.
 */
export async function deleteModuleById(
  bookId: string,
  moduleId: string,
): Promise<boolean> {
  const firestore = getAdminFirestore();
  const bookRef = firestore.collection(BOOKS_COLLECTION).doc(bookId);
  const moduleRef = bookRef.collection(MODULES_COLLECTION).doc(moduleId);

  return firestore.runTransaction(async (transaction) => {
    const moduleSnapshot = await transaction.get(moduleRef);

    if (!moduleSnapshot.exists) {
      return false;
    }

    transaction.delete(moduleRef);
    transaction.update(bookRef, {
      modules: FieldValue.arrayRemove(moduleId),
    });

    return true;
  });
}

/**
 * Bulk-deletes Module documents without touching `Book.modules` -- used only
 * by the Book cascade delete (see `deleteBookService`), where the parent
 * Book document is being deleted anyway.
 */
export async function deleteModulesByIds(
  bookId: string,
  moduleIds: string[],
): Promise<void> {
  if (moduleIds.length === 0) {
    return;
  }

  const collection = modulesCollection(bookId);

  await deleteRefsInBatches(
    getAdminFirestore(),
    moduleIds.map((id) => collection.doc(id)),
  );
}
