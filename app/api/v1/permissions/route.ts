import { NextResponse } from "next/server";

import {
  createPermission,
  listPermissions,
} from "@/lib/permissions/permissions-service";
import { permissionErrorResponse, requireSuperAdmin } from "./shared";

/** Lists all `permissions` records. Restricted to the super admin. */
export async function GET() {
  const auth = await requireSuperAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const data = await listPermissions();

  return NextResponse.json({ data });
}

/**
 * Creates or updates a `permissions` record (see ANA-49). Restricted to the
 * super admin -- this only stores permission data, dashboard access
 * enforcement lives in lib/auth/access.ts (see ANA-50).
 */
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const result = await createPermission({
    email: body?.email,
    permissions: body?.permissions,
    expiresAt: body?.expiresAt,
    actorEmail: auth.actorEmail,
  });

  if (!result.ok) {
    return permissionErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
