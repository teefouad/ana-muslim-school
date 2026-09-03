import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
} from "@/lib/auth/verify-session";

/**
 * Server-side enforcement that /admin/* requires an authenticated session,
 * in addition to (not instead of) the check performed by the protected
 * page/DAL -- see lib/auth/session.ts. This stops an unauthenticated
 * request before it ever renders the protected route.
 *
 * This does not check super-admin authorization -- an authenticated but
 * unapproved account is allowed through so the page can render its
 * "pending approval" state; the page itself checks `isSuperAdminEmail`.
 */
export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionCookie(sessionCookie);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
