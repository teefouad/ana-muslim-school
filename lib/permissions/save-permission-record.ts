import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { PERMISSIONS_COLLECTION } from "./constants";
import type { PermissionInput } from "./types";

/**
 * Creates a permission record for `input.email`, or updates the existing
 * one if a record for that normalized email already exists -- callers must
 * not create duplicate records for the same email.
 *
 * `actorEmail` must come from the caller's verified server-side session,
 * never from client-supplied data (see route handler).
 */
export async function savePermissionRecord(
  input: PermissionInput,
  actorEmail: string,
): Promise<string> {
  const collection = getAdminFirestore().collection(PERMISSIONS_COLLECTION);

  const existing = await collection
    .where("email", "==", input.email)
    .limit(1)
    .get();

  const expiresAt = input.expiresAt
    ? Timestamp.fromDate(input.expiresAt)
    : null;

  if (!existing.empty) {
    const doc = existing.docs[0];

    await doc.ref.update({
      email: input.email,
      permissions: input.permissions,
      expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });

    return doc.id;
  }

  const created = await collection.add({
    email: input.email,
    permissions: input.permissions,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actorEmail,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
    lastLoginAt: null,
  });

  return created.id;
}
