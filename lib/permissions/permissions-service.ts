import "server-only";

import { isValidEmail, normalizeEmail } from "@/lib/validation/email";
import { parseExpiresAt, toBooleanFlags } from "./parse-input";
import {
  deletePermissionById,
  getPermissionById as getPermissionByIdFromRepo,
  getPermissionForEmail as getPermissionForEmailFromRepo,
  listPermissions as listPermissionsFromRepo,
  recordPermissionLogin as recordPermissionLoginInRepo,
  updatePermissionById,
  upsertPermission,
} from "./permissions-repository";
import type { PermissionRecord } from "./types";

export type PermissionServiceError =
  | "missing-email"
  | "invalid-email"
  | "invalid-expiration"
  | "invalid-id"
  | "not-found";

export type PermissionServiceResult<T = void> =
  { ok: true; value: T } | { ok: false; error: PermissionServiceError };

function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

function fail(error: PermissionServiceError): {
  ok: false;
  error: PermissionServiceError;
} {
  return { ok: false, error };
}

/**
 * A single URL path segment can decode to a literal "/" (from an encoded
 * `%2F`), which would make Firestore's `.doc(id)` resolve a nested sub-path
 * instead of a document directly in the `permissions` collection -- reject
 * it here so every id-based operation gets the same guard (see ANA-51).
 */
function isValidPermissionId(id: string): boolean {
  return Boolean(id) && !id.includes("/");
}

export async function listPermissions(): Promise<PermissionRecord[]> {
  return listPermissionsFromRepo();
}

export async function getPermissionById(
  id: string,
): Promise<PermissionServiceResult<PermissionRecord>> {
  if (!isValidPermissionId(id)) {
    return fail("invalid-id");
  }

  const record = await getPermissionByIdFromRepo(id);

  return record ? ok(record) : fail("not-found");
}

/**
 * Resolves the permission record for a given account email, for use on the
 * dashboard access-control path (see ANA-50). Normalizes `email` so the same
 * address always maps to the same record regardless of how the caller
 * typed/cased it -- callers don't need to normalize it themselves.
 */
export async function getPermissionForEmail(
  email: string,
): Promise<PermissionRecord | null> {
  return getPermissionForEmailFromRepo(normalizeEmail(email));
}

type CreatePermissionInput = {
  email: unknown;
  permissions: unknown;
  expiresAt: unknown;
  actorEmail: string;
};

/**
 * Creates a permission record for `email`, or updates the existing record
 * for that normalized email if one already exists (see ANA-49). `actorEmail`
 * must be derived by the caller from a verified session/token, never from
 * caller-supplied input, so it can't be spoofed.
 */
export async function createPermission({
  email: rawEmail,
  permissions,
  expiresAt: rawExpiresAt,
  actorEmail,
}: CreatePermissionInput): Promise<PermissionServiceResult> {
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return fail("missing-email");
  }

  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email)) {
    return fail("invalid-email");
  }

  const expiresAtResult = parseExpiresAt(rawExpiresAt);

  if (!expiresAtResult.ok) {
    return fail("invalid-expiration");
  }

  await upsertPermission({
    email,
    permissions: toBooleanFlags(permissions),
    expiresAt: expiresAtResult.value,
    actorEmail,
  });

  return ok(undefined);
}

type UpdatePermissionInput = {
  id: string;
  permissions: unknown;
  expiresAt: unknown;
  actorEmail: string;
};

/**
 * Updates an existing record's permissions/expiration by its Firestore
 * document ID (see ANA-51). Email is intentionally not accepted here --
 * editing a record never changes which account it belongs to.
 */
export async function updatePermission({
  id,
  permissions,
  expiresAt: rawExpiresAt,
  actorEmail,
}: UpdatePermissionInput): Promise<PermissionServiceResult> {
  if (!isValidPermissionId(id)) {
    return fail("invalid-id");
  }

  const expiresAtResult = parseExpiresAt(rawExpiresAt);

  if (!expiresAtResult.ok) {
    return fail("invalid-expiration");
  }

  const updated = await updatePermissionById({
    id,
    permissions: toBooleanFlags(permissions),
    expiresAt: expiresAtResult.value,
    actorEmail,
  });

  return updated ? ok(undefined) : fail("not-found");
}

/**
 * Deletes a permission record by its Firestore document ID (see ANA-51).
 * Only removes the permission document -- it never touches the
 * corresponding Firebase Authentication account.
 */
export async function deletePermission(
  id: string,
): Promise<PermissionServiceResult> {
  if (!isValidPermissionId(id)) {
    return fail("invalid-id");
  }

  const deleted = await deletePermissionById(id);

  return deleted ? ok(undefined) : fail("not-found");
}

/**
 * Stamps a permission document with the current time as its last login (see
 * ANA-50). Callers must not let a failure here weaken or bypass
 * authorization.
 */
export async function recordPermissionLogin(id: string): Promise<void> {
  await recordPermissionLoginInRepo(id);
}
