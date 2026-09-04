/**
 * Normalizes an email address for storage/lookup: trims surrounding
 * whitespace and lowercases it, since Firestore equality lookups are
 * case-sensitive and emails aren't.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
