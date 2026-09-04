import "server-only";

import type { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { PERMISSIONS_COLLECTION } from "./constants";
import type { PermissionRecord } from "./types";

function toDate(value: Timestamp | null | undefined): Date | null {
  return value ? value.toDate() : null;
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
      expiresAt: toDate(data.expiresAt),
      createdAt: toDate(data.createdAt),
      createdBy: data.createdBy,
      updatedAt: toDate(data.updatedAt),
      updatedBy: data.updatedBy,
      lastLoginAt: toDate(data.lastLoginAt),
    };
  });
}
