import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";

export const PERMISSIONS_COLLECTION = "permissions";

export type BookPermissions = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export type PermissionRecordInput = {
  email: string;
  books: BookPermissions;
  manageUsers: boolean;
  expiresAt: Date | null;
};

export type PermissionRecord = {
  id: string;
  email: string;
  permissions: {
    books: BookPermissions;
    users: { manage: boolean };
  };
  expiresAt: Date | null;
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
  lastLoginAt: Date | null;
};

async function findPermissionDocIdByEmail(
  email: string,
): Promise<string | null> {
  const snapshot = await getAdminFirestore()
    .collection(PERMISSIONS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].id;
}

/**
 * Creates a permission record for `input.email`, or updates the existing
 * record for that (already-normalized) email if one exists -- Firestore
 * auto-generates the document ID either way, the email is never used as the
 * ID, and a server-side lookup by email is what prevents duplicates.
 *
 * `actorEmail` must come from the caller's verified server-side session,
 * never from client-supplied form data.
 */
export async function savePermissionRecord(
  input: PermissionRecordInput,
  actorEmail: string,
): Promise<void> {
  const db = getAdminFirestore();
  const existingId = await findPermissionDocIdByEmail(input.email);

  const data = {
    email: input.email,
    permissions: {
      books: input.books,
      users: { manage: input.manageUsers },
    },
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
  };

  if (existingId) {
    await db
      .collection(PERMISSIONS_COLLECTION)
      .doc(existingId)
      .set(data, { merge: true });
    return;
  }

  await db.collection(PERMISSIONS_COLLECTION).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actorEmail,
    lastLoginAt: null,
  });
}

function toDateOrNull(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

export async function listPermissionRecords(): Promise<PermissionRecord[]> {
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
      expiresAt: toDateOrNull(data.expiresAt),
      createdAt: toDateOrNull(data.createdAt),
      createdBy: data.createdBy,
      updatedAt: toDateOrNull(data.updatedAt),
      updatedBy: data.updatedBy,
      lastLoginAt: toDateOrNull(data.lastLoginAt),
    };
  });
}
