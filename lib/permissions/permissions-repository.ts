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
 * Looks up a record by normalized email so `upsertPermission` can update the
 * existing record instead of creating a duplicate.
 */
async function findPermissionDocByEmail(email: string) {
  const snapshot = await getAdminFirestore()
    .collection(PERMISSIONS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0];
}

/**
 * Creates a permission record for `email`, or updates the existing record
 * for that normalized email if one already exists -- the `permissions`
 * collection is looked up by the `email` field rather than by document ID
 * (see ANA-49), so this lookup-then-write is how duplicates are prevented.
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
  const existing = await findPermissionDocByEmail(email);
  const expiresAtValue = expiresAt ? Timestamp.fromDate(expiresAt) : null;

  if (existing) {
    await existing.ref.update({
      permissions,
      expiresAt: expiresAtValue,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });
    return;
  }

  await firestore.collection(PERMISSIONS_COLLECTION).add({
    email,
    permissions,
    expiresAt: expiresAtValue,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actorEmail,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
    lastLoginAt: null,
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
