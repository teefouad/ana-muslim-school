import { NextResponse } from "next/server";

import {
  deletePermission,
  getPermissionById,
  updatePermission,
} from "@/lib/permissions/permissions-service";
import {
  parseJsonObject,
  permissionErrorResponse,
  requireSuperAdmin,
} from "../shared";

/** Reads a single `permissions` record by its Firestore document ID. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/permissions/[id]">,
) {
  const auth = await requireSuperAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const result = await getPermissionById(id);

  if (!result.ok) {
    return permissionErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}

/**
 * Partially updates an existing `permissions` record's permissions/
 * expiration by its Firestore document ID. Restricted to the super admin.
 * Email is intentionally not accepted here -- editing a record never
 * changes which account it belongs to (see ANA-51).
 *
 * A field the caller omits from the request body is left unchanged rather
 * than reset to a default -- e.g. sending only `expiresAt` never touches
 * `permissions`. A malformed or non-object body is rejected outright rather
 * than treated as "no fields given", since silently no-op'ing a broken
 * request would hide the caller's mistake (see ANA-54 PR review).
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/v1/permissions/[id]">,
) {
  const auth = await requireSuperAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await updatePermission({
    id,
    permissions: body.value.permissions,
    expiresAt: body.value.expiresAt,
    actorEmail: auth.actorEmail,
  });

  if (!result.ok) {
    return permissionErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Deletes a `permissions` record by its Firestore document ID. Restricted to
 * the super admin. Only removes the permission document -- it never deletes
 * or modifies the corresponding Firebase Authentication account (see
 * ANA-51).
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/v1/permissions/[id]">,
) {
  const auth = await requireSuperAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const result = await deletePermission(id);

  if (!result.ok) {
    return permissionErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
