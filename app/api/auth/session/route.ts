import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/auth/session";

/**
 * Exchanges a Firebase ID token (obtained client-side after sign-in) for an
 * httpOnly session cookie. Any account with a valid Firebase ID token gets a
 * session cookie -- this only confirms the request is authenticated.
 * Authorization (whether the account is the configured super admin) is a
 * separate, page-level check (see lib/auth/session.ts), so a newly created
 * account can sign in and land on a "pending approval" state instead of
 * being rejected outright.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = body?.idToken;

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json(
      { error: "Your sign-in could not be verified. Please try again." },
      { status: 401 },
    );
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  (await cookies()).set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
