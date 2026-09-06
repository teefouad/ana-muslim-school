import "server-only";

import type { Timestamp } from "firebase-admin/firestore";

/**
 * Converts a Firestore Timestamp to a JS Date, shared across the
 * learning-content repositories (Books/Modules/Lessons/Questions) -- see
 * lib/permissions/permissions-repository.ts for the original,
 * resource-specific version of this helper.
 */
export function timestampToDate(
  value: Timestamp | null | undefined,
): Date | null {
  return value ? value.toDate() : null;
}
