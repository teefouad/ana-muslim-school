/**
 * Shared result/error shape for the learning-content services (Sources,
 * Materials, Books, Modules, Lessons, Questions). Unlike `permissions`,
 * which is the only resource with its own bespoke error union, these six
 * resources share an identical error vocabulary (bad input, missing
 * resource, integrity conflict, ...), so a single mapping avoids repeating
 * the same `ServiceError -> HTTP status` table six times (see AGENTS.md's
 * allowance for shared "domain-error -> HTTP-status mapping" helpers).
 */
export type ServiceErrorCode = "invalid-input" | "not-found" | "conflict";

export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
};

export type ServiceResult<T = void> =
  { ok: true; value: T } | { ok: false; error: ServiceError };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fail(
  code: ServiceErrorCode,
  message: string,
): { ok: false; error: ServiceError } {
  return { ok: false, error: { code, message } };
}
