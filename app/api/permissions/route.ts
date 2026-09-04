import { NextResponse } from "next/server";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { parseExpiresAt, toBooleanFlags } from "@/lib/permissions/parse-input";
import { upsertPermission } from "@/lib/permissions/permissions-repository";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";

/**
 * Creates or updates a `permissions` record. Restricted to the super admin
 * -- this only stores permission data; nothing in the app enforces it yet
 * (see ANA-49/ANA-50).
 *
 * `createdBy`/`updatedBy` are always derived from the verified server-side
 * session, never from the request body, so a caller can't spoof who granted
 * access.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user || !isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawEmail = body?.email;

  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const expiresAtResult = parseExpiresAt(body?.expiresAt);

  if (!expiresAtResult.ok) {
    return NextResponse.json(
      { error: "Invalid expiration date." },
      { status: 400 },
    );
  }

  await upsertPermission({
    email,
    permissions: toBooleanFlags(body?.permissions),
    expiresAt: expiresAtResult.value,
    actorEmail: user.email,
  });

  return NextResponse.json({ ok: true });
}
