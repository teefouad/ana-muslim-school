import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, verifySessionCookie } from "./verify-session";

export {
  isSuperAdminEmail,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  verifySessionCookie,
  type SessionUser,
} from "./verify-session";

/**
 * Data Access Layer entry point for Server Components/Route Handlers.
 * Cached per-request so multiple calls don't re-verify the cookie.
 *
 * Returns any authenticated account, not just the super admin -- callers
 * that need to gate admin-only content must check `isSuperAdminEmail`
 * against the returned user's email separately.
 */
export const getSessionUser = cache(async () => {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return verifySessionCookie(sessionCookie);
});
