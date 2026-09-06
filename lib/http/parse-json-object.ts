export type ParsedJsonObject =
  { ok: true; value: Record<string, unknown> } | { ok: false };

/**
 * Parses a request body as a JSON object. Malformed JSON, a non-object
 * payload (e.g. an array or a bare string/number), or a `null` body all fail
 * here -- shared across every /api/v1 write route (see
 * app/api/v1/permissions/shared.ts for the original, resource-specific
 * version of this helper).
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
