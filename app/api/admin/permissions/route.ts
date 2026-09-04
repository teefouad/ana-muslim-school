import { NextResponse } from "next/server";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { parsePermissionInput } from "@/lib/permissions/parse-permission-input";
import { savePermissionRecord } from "@/lib/permissions/save-permission-record";

/**
 * Creates/updates a permission record. Only the super admin may call this --
 * authorization is derived from the verified server-side session, never
 * from client-supplied data.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user || !isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const result = parsePermissionInput(body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const id = await savePermissionRecord(result.value, user.email);

  return NextResponse.json({ ok: true, id });
}
