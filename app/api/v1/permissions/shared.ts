import { NextResponse } from "next/server";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import type { PermissionServiceError } from "@/lib/permissions/permissions-service";

type Authorized = { ok: true; actorEmail: string };
type Unauthorized = { ok: false; response: NextResponse };

/**
 * Shared super-admin gate for every /api/v1/permissions route -- permission
 * administration is restricted to the super admin (see ANA-49/50/51). The
 * returned `actorEmail` is always derived from the verified server-side
 * session, never from request input, so a caller can't spoof who made a
 * change.
 */
export async function requireSuperAdmin(): Promise<Authorized | Unauthorized> {
  const user = await getSessionUser();

  if (!user || !isSuperAdminEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true, actorEmail: user.email };
}

type ParsedJsonObject =
  { ok: true; value: Record<string, unknown> } | { ok: false };

/**
 * Parses a request body as a JSON object, for handlers that treat a missing
 * key as "leave this field unchanged" (see `updatePermission`). Malformed
 * JSON, a non-object payload (e.g. an array or a bare string/number), or a
 * `null` body all fail here rather than being coerced into `{}` -- silently
 * treating unparsable input as "no fields given" would let a broken request
 * succeed as a no-op write instead of surfacing the caller's mistake.
 */
export async function parseJsonObject(
  request: Request,
): Promise<ParsedJsonObject> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { ok: false };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false };
  }

  return { ok: true, value: body as Record<string, unknown> };
}

const ERROR_RESPONSES: Record<
  PermissionServiceError,
  { status: number; message: string }
> = {
  "missing-email": { status: 400, message: "Email is required." },
  "invalid-email": { status: 400, message: "Enter a valid email address." },
  "invalid-expiration": { status: 400, message: "Invalid expiration date." },
  "invalid-id": { status: 400, message: "Invalid record id." },
  "not-found": { status: 404, message: "Record not found." },
};

/** Maps a permissions-service failure to the equivalent HTTP response. */
export function permissionErrorResponse(
  error: PermissionServiceError,
): NextResponse {
  const { status, message } = ERROR_RESPONSES[error];
  return NextResponse.json({ error: message }, { status });
}
