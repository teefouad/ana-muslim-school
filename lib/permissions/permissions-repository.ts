import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentSnapshot } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  isValidPermissionsInput,
  type PermissionRecord,
  type PermissionsInput,
} from "./types";

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

type UpdatePermissionByIdInput = {
  id: string;
  permissions: PermissionsInput;
  expiresAt: Date | null;
  actorEmail: string;
};

/**
 * Updates the `permissions`/`expiresAt` of an existing record by its
 * Firestore document ID (see ANA-51) -- unlike `upsertPermission`, this
 * never creates a record and never looks the record up by email, so it
 * can't be tricked into editing (or creating a duplicate for) a different
 * account. `createdAt`, `createdBy`, and `lastLoginAt` are left untouched
 * since `update()` only writes the fields given here.
 *
 * Returns `false` without writing if `id` doesn't match an existing
 * document, so the caller can respond with a 404 instead of silently
 * creating Firestore's implicit empty document.
 */
export async function updatePermissionById({
  id,
  permissions,
  expiresAt,
  actorEmail,
}: UpdatePermissionByIdInput): Promise<boolean> {
  const ref = getAdminFirestore().collection(PERMISSIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return false;
  }

  await ref.update({
    permissions,
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
  });

  return true;
}

/**
 * Deletes a `permissions` record by its Firestore document ID (see ANA-51).
 * Only removes the permission document -- it never touches the
 * corresponding Firebase Authentication account.
 *
 * Returns `false` without writing if `id` doesn't match an existing
 * document, so the caller can respond with a 404 rather than a false
 * "deleted" success.
 */
export async function deletePermissionById(id: string): Promise<boolean> {
  const ref = getAdminFirestore().collection(PERMISSIONS_COLLECTION).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return false;
  }

  await ref.delete();

  return true;
}

/**
 * Looks up a `permissions` record by its Firestore document ID. Returns
 * `null` for a missing or malformed document, so callers can respond with a
 * 404 rather than trusting a coerced/default record.
 */
export async function getPermissionById(
  id: string,
): Promise<PermissionRecord | null> {
  const snapshot = await getAdminFirestore()
    .collection(PERMISSIONS_COLLECTION)
    .doc(id)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return parsePermissionRecord(snapshot);
}

/**
 * Parses a `permissions` document into a `PermissionRecord`, or `null` if
 * the document doesn't match the expected shape. Used on the dashboard
 * access path (see `getPermissionForEmail`), where a malformed record must
 * fail closed rather than grant access with coerced/default values.
 */
function parsePermissionRecord(doc: DocumentSnapshot): PermissionRecord | null {
  try {
    const data = doc.data();

    if (
      !data ||
      typeof data.email !== "string" ||
      !isValidPermissionsInput(data.permissions)
    ) {
      return null;
    }

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
  } catch {
    return null;
  }
}

/**
 * Looks up the permission record for a normalized email, for use on the
 * dashboard access-control path (see ANA-50). Returns `null` for a missing,
 * malformed, or duplicate/ambiguous record -- callers must treat `null` as
 * "no active permission" and fail closed rather than grant access.
 *
 * `email` must already be normalized (trimmed/lowercased) by the caller --
 * see lib/validation/email.ts.
 */
export async function getPermissionForEmail(
  email: string,
): Promise<PermissionRecord | null> {
  const snapshot = await getAdminFirestore()
    .collection(PERMISSIONS_COLLECTION)
    .where("email", "==", email)
    .get();

  if (snapshot.size !== 1) {
    return null;
  }

  return parsePermissionRecord(snapshot.docs[0]);
}

/**
 * Stamps a permission document with the current time as its last login.
 * Callers must not let a failure here weaken or bypass authorization --
 * see ANA-50.
 */
export async function recordPermissionLogin(id: string): Promise<void> {
  await getAdminFirestore().collection(PERMISSIONS_COLLECTION).doc(id).update({
    lastLoginAt: FieldValue.serverTimestamp(),
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
