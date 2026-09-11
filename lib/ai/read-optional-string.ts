import "server-only";

/** Reads an optional string request field -- `undefined` when the caller
 * omitted it (a valid, common case: not every sibling Module field is
 * filled in yet), `{ ok: false }` when it was supplied but isn't a string.
 * Shared by every `/api/v1/ai/*` service that accepts an optional Arabic
 * context field (ANA-99), since AI context is always a plain Arabic string
 * now, never a bilingual `{ ar, en }` object. */
export function readOptionalString(
  value: unknown,
): { ok: true; value?: string } | { ok: false } {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  return typeof value === "string" ? { ok: true, value } : { ok: false };
}
