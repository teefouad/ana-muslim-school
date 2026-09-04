import dayjs from "dayjs";
import { NextResponse } from "next/server";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { upsertPermission } from "@/lib/permissions/permissions-repository";
import type { PermissionsInput } from "@/lib/permissions/types";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";

function toBooleanFlags(value: unknown): PermissionsInput {
  const books =
    value && typeof value === "object" && "books" in value
      ? (value as { books?: unknown }).books
      : undefined;
  const users =
    value && typeof value === "object" && "users" in value
      ? (value as { users?: unknown }).users
      : undefined;
  const booksObj = (books ?? {}) as Record<string, unknown>;
  const usersObj = (users ?? {}) as Record<string, unknown>;

  return {
    books: {
      read: booksObj.read === true,
      create: booksObj.create === true,
      update: booksObj.update === true,
      delete: booksObj.delete === true,
    },
    users: {
      manage: usersObj.manage === true,
    },
  };
}

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

  let expiresAt: Date | null = null;
  const rawExpiresAt = body?.expiresAt;

  if (typeof rawExpiresAt === "string" && rawExpiresAt) {
    // The client converts the DateTimePicker's timezone-less value to an
    // ISO string (with an explicit UTC offset) before sending it, so the
    // instant is preserved regardless of which timezone the server runs in
    // -- see app/admin/manage-users/permission-form.tsx. dayjs parses that
    // reliably across JS engines, unlike the native `Date` constructor.
    const parsed = dayjs(rawExpiresAt);

    if (!parsed.isValid()) {
      return NextResponse.json(
        { error: "Invalid expiration date." },
        { status: 400 },
      );
    }

    expiresAt = parsed.toDate();
  }

  await upsertPermission({
    email,
    permissions: toBooleanFlags(body?.permissions),
    expiresAt,
    actorEmail: user.email,
  });

  return NextResponse.json({ ok: true });
}
