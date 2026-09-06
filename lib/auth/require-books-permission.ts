import "server-only";

import { NextResponse } from "next/server";

import type { BookPermissions } from "@/lib/permissions/types";
import { getDashboardAccess } from "./access";
import { getSessionUser } from "./session";

type Authorized = { ok: true; actorEmail: string };
type Unauthorized = { ok: false; response: NextResponse };

/**
 * Shared authorization gate for every /api/v1 route in the learning-content
 * domain (Sources, Materials, Books, Modules, Lessons, Questions). Per
 * ANA-62, all of these map onto the existing Books permission flags: GETs
 * require `books.read`; Book create/update/delete require the matching
 * `books.*` flag; every Source/Material/Module/Lesson/Question mutation is
 * treated as a Books content change and requires `books.update`.
 *
 * The super-admin bypass and pending/expired handling are inherited from
 * `getDashboardAccess` (see lib/auth/access.ts) so this can't drift from the
 * dashboard's own access rules.
 */
export async function requireBooksPermission(
  action: keyof BookPermissions,
): Promise<Authorized | Unauthorized> {
  const user = await getSessionUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const access = await getDashboardAccess();

  if (!access || access.status === "pending" || access.status === "expired") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  if (
    access.status === "active" &&
    !access.permission.permissions.books[action]
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true, actorEmail: user.email };
}
