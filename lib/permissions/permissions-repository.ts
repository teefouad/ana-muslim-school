import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import type { PermissionRecord, PermissionsInput } from "./types";

export const PERMISSIONS_COLLECTION = "permissions";

type UpsertPermissionInput = {
  email: string;
  permissions: PermissionsInput;
  expiresAt: Date | null;
  actorEmail: string;
};

function toDate(value: Timestamp | null | undefined): Date | null {
  return value ? value.toDate() : null;
}

/**
 * Creates a permission record for `email`, or updates the existing record
 * for that normalized email if one already exists -- the `permissions`
 * collection is looked up by the `email` field rather than by document ID
 * (see ANA-49). Runs in a transaction so the lookup-then-write is atomic:
 * `transaction.get(query)` holds a lock on the matched documents for the
 * life of the transaction, so two concurrent requests for the same email
 * can't both see "no existing record" and each create a duplicate.
 *
 * `email` must already be normalized (trimmed/lowercased) by the caller --
 * see lib/validation/email.ts.
 */
export async function upsertPermission({
  email,
  permissions,
  expiresAt,
  actorEmail,
}: UpsertPermissionInput): Promise<void> {
  const firestore = getAdminFirestore();
  const collection = firestore.collection(PERMISSIONS_COLLECTION);
  const expiresAtValue = expiresAt ? Timestamp.fromDate(expiresAt) : null;

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(
      collection.where("email", "==", email).limit(1),
    );

    if (!snapshot.empty) {
      transaction.update(snapshot.docs[0].ref, {
        permissions,
        expiresAt: expiresAtValue,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorEmail,
      });
      return;
    }

    transaction.set(collection.doc(), {
      email,
      permissions,
      expiresAt: expiresAtValue,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actorEmail,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
      lastLoginAt: null,
    });
  });
}

export async function listPermissions(): Promise<PermissionRecord[]> {
  const snapshot = await getAdminFirestore()
    .collection(PERMISSIONS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      email: data.email,
      permissions: data.permissions,
      expiresAt: toDate(data.expiresAt),
      createdAt: toDate(data.createdAt) ?? new Date(0),
      createdBy: data.createdBy,
      updatedAt: toDate(data.updatedAt) ?? new Date(0),
      updatedBy: data.updatedBy,
      lastLoginAt: toDate(data.lastLoginAt),
    };
  });
}
