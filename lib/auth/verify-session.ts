import "server-only";

import { getAdminAuth } from "@/lib/firebase/admin";

export { isSuperAdminEmail } from "./is-super-admin-email";

export const SESSION_COOKIE_NAME = "session";

// Firebase session cookies support a maximum lifetime of 14 days.
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  uid: string;
  email: string;
};

/**
 * Verifies a Firebase session cookie and returns the authenticated account.
 * Returns `null` for any missing/invalid/revoked cookie rather than
 * throwing, since an invalid session is an expected, routine case (expired
 * cookie, signed-out user, etc.).
 *
 * This only confirms the request is authenticated -- it does NOT check
 * whether the account is the configured super admin. Callers that need to
 * gate admin-only content must check `isSuperAdminEmail` against the
 * returned user's email separately (see lib/auth/session.ts and
 * app/admin/page.tsx).
 *
 * Deliberately has no dependency on `next/headers` so it can be called from
 * both Server Components/Route Handlers and Proxy.
 */
export async function verifySessionCookie(
  sessionCookie: string | undefined,
): Promise<SessionUser | null> {
  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true /* checkRevoked */,
    );

    return { uid: decoded.uid, email: decoded.email! };
  } catch {
    return null;
  }
}
