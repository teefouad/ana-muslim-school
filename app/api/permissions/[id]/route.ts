import { NextResponse } from "next/server";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { parseExpiresAt, toBooleanFlags } from "@/lib/permissions/parse-input";
import { updatePermissionById } from "@/lib/permissions/permissions-repository";

/**
 * Updates an existing `permissions` record's permissions/expiration by its
 * Firestore document ID. Restricted to the super admin. Email is
 * intentionally not accepted here -- editing a record never changes which
 * account it belongs to (see ANA-51).
 *
 * `updatedBy` is always derived from the verified server-side session,
 * never from the request body, so a caller can't spoof who made the change.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/permissions/[id]">,
) {
  const user = await getSessionUser();

  if (!user || !isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  // `id` is a single URL path segment, but an encoded slash (`%2F`) decodes
  // to a literal "/" here -- passed straight through, that would make
  // Firestore's `.doc(id)` resolve a nested sub-path instead of a document
  // directly in the `permissions` collection, so reject it explicitly.
  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  const expiresAtResult = parseExpiresAt(body?.expiresAt);

  if (!expiresAtResult.ok) {
    return NextResponse.json(
      { error: "Invalid expiration date." },
      { status: 400 },
    );
  }

  const updated = await updatePermissionById({
    id,
    permissions: toBooleanFlags(body?.permissions),
    expiresAt: expiresAtResult.value,
    actorEmail: user.email,
  });

  if (!updated) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
