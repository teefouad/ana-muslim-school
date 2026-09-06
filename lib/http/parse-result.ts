/**
 * Shared result shape for the learning-content resources' request-body
 * parsers (see each resource's validation.ts). Distinct from
 * `lib/http/service-result.ts`'s `ServiceResult` -- a parse failure is
 * always a single human-readable message, not a `{ code, message }` pair,
 * since it never needs to carry an HTTP-status code on its own (the calling
 * service always maps a parse failure to `invalid-input`).
 */
export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; message: string };

export function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

export function fail<T>(message: string): ParseResult<T> {
  return { ok: false, message };
}
