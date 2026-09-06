/**
 * Checks that `value` contains no keys outside `allowedKeys`, so a write
 * endpoint can reject a body carrying an unknown/non-writable field (e.g.
 * `id`, `createdAt`, a path-owned parent id) instead of silently ignoring
 * it. Shared across every learning-content resource's input parser (see
 * ANA-62).
 */
export function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}
