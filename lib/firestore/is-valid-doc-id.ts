/**
 * A single URL path segment can decode to a literal "/" (from an encoded
 * `%2F`), which would make Firestore's `.doc(id)` resolve a nested sub-path
 * instead of a document directly in the intended collection -- reject it
 * here so every id-based route in the learning-content domain gets the same
 * guard (see lib/permissions/permissions-service.ts for the original,
 * resource-specific version of this check).
 */
export function isValidDocId(id: string): boolean {
  return Boolean(id) && !id.includes("/");
}
