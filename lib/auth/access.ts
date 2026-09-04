import "server-only";

import { cache } from "react";

import { getPermissionForEmail } from "@/lib/permissions/permissions-repository";
import type { PermissionRecord } from "@/lib/permissions/types";
import { normalizeEmail } from "@/lib/validation/email";
import { isSuperAdminEmail } from "./is-super-admin-email";
import { getSessionUser } from "./session";
import type { SessionUser } from "./verify-session";

export type DashboardAccess =
  | { status: "super-admin" }
  | { status: "active"; permission: PermissionRecord }
  | { status: "pending" }
  | { status: "expired"; permission: PermissionRecord };

/**
 * Resolves whether an authenticated user may access the dashboard, per the
 * access rules in ANA-50: the super admin always gets in; anyone else needs
 * an active (non-expired) `permissions` record for their normalized email.
 *
 * Never trust a client-supplied email -- `user` must come from the verified
 * Firebase session (see lib/auth/session.ts), not request input.
 */
export async function resolveDashboardAccess(
  user: SessionUser,
): Promise<DashboardAccess> {
  if (isSuperAdminEmail(user.email)) {
    return { status: "super-admin" };
  }

  const permission = await getPermissionForEmail(normalizeEmail(user.email));

  if (!permission) {
    return { status: "pending" };
  }

  if (permission.expiresAt && permission.expiresAt.getTime() <= Date.now()) {
    return { status: "expired", permission };
  }

  return { status: "active", permission };
}

/**
 * Data Access Layer entry point for Server Components/Route Handlers that
 * need the resolved dashboard access for the current request -- cached per
 * request (like `getSessionUser`) so later authorization checks (e.g.
 * follow-up tasks enforcing individual `permission.permissions` flags) don't
 * need to re-query Firestore. Returns `null` when there's no authenticated
 * session.
 */
export const getDashboardAccess = cache(
  async (): Promise<DashboardAccess | null> => {
    const user = await getSessionUser();
    return user ? resolveDashboardAccess(user) : null;
  },
);
