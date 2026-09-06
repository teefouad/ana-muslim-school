import "server-only";

import type { DocumentSnapshot } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { deleteRefsInBatches } from "@/lib/firestore/delete-refs-in-batches";
import {
  isValidMaterialDocument,
  type Material,
  type MaterialWritableFields,
} from "./types";

export const MATERIALS_COLLECTION = "materials";

function parseMaterialDocument(doc: DocumentSnapshot): Material | null {
  try {
    const data = doc.data();

    if (!data || !isValidMaterialDocument(data)) {
      return null;
    }

    return {
      id: doc.id,
      bookId: data.bookId,
      moduleId: data.moduleId,
      content: data.content,
    };
  } catch {
    return null;
  }
}

export async function createMaterial(
  fields: MaterialWritableFields,
): Promise<Material> {
  const ref = getAdminFirestore().collection(MATERIALS_COLLECTION).doc();

  await ref.set(fields);

  return { id: ref.id, ...fields };
}

export async function getMaterialById(id: string): Promise<Material | null> {
  const snapshot = await getAdminFirestore()
    .collection(MATERIALS_COLLECTION)
    .doc(id)
    .get();

  return snapshot.exists ? parseMaterialDocument(snapshot) : null;
}

export async function listMaterials(): Promise<Material[]> {
  const snapshot = await getAdminFirestore()
    .collection(MATERIALS_COLLECTION)
    .get();

  return snapshot.docs
    .map(parseMaterialDocument)
    .filter((material): material is Material => material !== null);
}

/**
 * Partially updates a Material document by id. Returns `null` without
 * writing if `id` doesn't match an existing document.
 */
export async function updateMaterialById(
  id: string,
  fields: Partial<MaterialWritableFields>,
): Promise<Material | null> {
  const ref = getAdminFirestore().collection(MATERIALS_COLLECTION).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  await ref.update(fields);

  return parseMaterialDocument(await ref.get());
}

/**
 * Idempotently upserts a Material at the exact `id` given -- creates the
 * document when missing, and fully replaces its writable fields (`.set`
 * without merge) when it already exists, per the PUT semantics in ANA-62.
 */
export async function upsertMaterialById(
  id: string,
  fields: MaterialWritableFields,
): Promise<Material> {
  const ref = getAdminFirestore().collection(MATERIALS_COLLECTION).doc(id);

  await ref.set(fields);

  return { id, ...fields };
}

/** Returns `false` without deleting if `id` doesn't match an existing document. */
export async function deleteMaterialById(id: string): Promise<boolean> {
  const ref = getAdminFirestore().collection(MATERIALS_COLLECTION).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return false;
  }

  await ref.delete();

  return true;
}

/** Bulk-deletes every Material whose `bookId` matches -- used by the Book cascade delete. */
export async function deleteAllMaterialsForBook(bookId: string): Promise<void> {
  const snapshot = await getAdminFirestore()
    .collection(MATERIALS_COLLECTION)
    .where("bookId", "==", bookId)
    .get();

  await deleteRefsInBatches(
    getAdminFirestore(),
    snapshot.docs.map((doc) => doc.ref),
  );
}

/**
 * Whether any Material references `moduleId` under `bookId` -- used to block
 * Module deletion while it's still referenced (see ANA-62).
 */
export async function anyMaterialReferencesModule(
  bookId: string,
  moduleId: string,
): Promise<boolean> {
  const snapshot = await getAdminFirestore()
    .collection(MATERIALS_COLLECTION)
    .where("bookId", "==", bookId)
    .where("moduleId", "==", moduleId)
    .limit(1)
    .get();

  return !snapshot.empty;
}
