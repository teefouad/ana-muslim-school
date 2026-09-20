import "server-only";

import type { DocumentSnapshot } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { deleteRefsInBatches } from "@/lib/firestore/delete-refs-in-batches";
import {
  isValidSourceDocument,
  type Source,
  type SourceWritableFields,
} from "./types";

const SOURCES_COLLECTION = "sources";

function parseSourceDocument(doc: DocumentSnapshot): Source | null {
  try {
    const data = doc.data();

    if (!data || !isValidSourceDocument(data)) {
      return null;
    }

    return { id: doc.id, bookId: data.bookId, content: data.content };
  } catch {
    return null;
  }
}

export async function createSource(
  fields: SourceWritableFields,
): Promise<Source> {
  const ref = getAdminFirestore().collection(SOURCES_COLLECTION).doc();

  await ref.set(fields);

  return { id: ref.id, ...fields };
}

export async function getSourceById(id: string): Promise<Source | null> {
  const snapshot = await getAdminFirestore()
    .collection(SOURCES_COLLECTION)
    .doc(id)
    .get();

  return snapshot.exists ? parseSourceDocument(snapshot) : null;
}

/**
 * Lists Source documents, optionally filtered to a single Book via a
 * Firestore `where` query -- not a full collection fetch filtered
 * client-side (see ANA-71's Import Source "which Book already has a saved
 * Source" lookup).
 */
export async function listSources(bookId?: string): Promise<Source[]> {
  const collection = getAdminFirestore().collection(SOURCES_COLLECTION);
  const snapshot = await (
    bookId ? collection.where("bookId", "==", bookId) : collection
  ).get();

  return snapshot.docs
    .map(parseSourceDocument)
    .filter((source): source is Source => source !== null);
}

/**
 * Partially updates a Source document by id. Returns `null` without writing
 * if `id` doesn't match an existing document.
 */
export async function updateSourceById(
  id: string,
  fields: Partial<SourceWritableFields>,
): Promise<Source | null> {
  const ref = getAdminFirestore().collection(SOURCES_COLLECTION).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  await ref.update(fields);

  return parseSourceDocument(await ref.get());
}

/** Returns `false` without deleting if `id` doesn't match an existing document. */
export async function deleteSourceById(id: string): Promise<boolean> {
  const ref = getAdminFirestore().collection(SOURCES_COLLECTION).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return false;
  }

  await ref.delete();

  return true;
}

/** Bulk-deletes every Source whose `bookId` matches -- used by the Book cascade delete. */
export async function deleteAllSourcesForBook(bookId: string): Promise<void> {
  const snapshot = await getAdminFirestore()
    .collection(SOURCES_COLLECTION)
    .where("bookId", "==", bookId)
    .get();

  await deleteRefsInBatches(
    getAdminFirestore(),
    snapshot.docs.map((doc) => doc.ref),
  );
}
