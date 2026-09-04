/**
 * Kept dependency-free (no firebase-admin/server-only imports) so it can be
 * unit tested in isolation and reused from both server actions and their
 * data-access layer.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
