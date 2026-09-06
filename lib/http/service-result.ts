/**
 * Shared result/error shape for the learning-content services (Sources,
 * Materials, Books, Modules, Lessons, Questions). Unlike `permissions`,
 * which is the only resource with its own bespoke error union, these
 * resources share an identical error vocabulary (bad input, missing
 * resource, integrity conflict, ...), so a single mapping avoids repeating
 * the same `ServiceError -> HTTP status` table over and over (see AGENTS.md's
 * allowance for shared "domain-error -> HTTP-status mapping" helpers).
 *
 * `too-large` and `upstream-error` were added for the Source OCR import flow
 * (ANA-68), which -- unlike plain CRUD -- can fail because the uploaded PDF
 * exceeds the size limit, or because Firebase Storage/Mistral itself fails.
 */
export type ServiceErrorCode =
  "invalid-input" | "not-found" | "conflict" | "too-large" | "upstream-error";

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
