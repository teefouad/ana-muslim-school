import "server-only";

import type { DocumentReference, Firestore } from "firebase-admin/firestore";

// Firestore rejects a batch with more than 500 writes.
const MAX_BATCH_SIZE = 500;

/**
 * Deletes an arbitrary number of documents, chunking into multiple batches
 * of Firestore's 500-write limit. Shared by every bulk-delete operation in
 * the learning-content domain (Book cascade delete, and the
 * delete-all-children helpers each subcollection repository exposes for
 * it -- see ANA-62).
 */
export async function deleteRefsInBatches(
  firestore: Firestore,
  refs: DocumentReference[],
): Promise<void> {
  for (let i = 0; i < refs.length; i += MAX_BATCH_SIZE) {
    const batch = firestore.batch();

    for (const ref of refs.slice(i, i + MAX_BATCH_SIZE)) {
      batch.delete(ref);
    }

    await batch.commit();
  }
}
