const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trims whitespace and lowercases an email so the same address always maps
 * to the same permission record, regardless of how it was typed/cased.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Deliberately a loose format check (not a full RFC 5322 validator) --
 * good enough to catch obvious typos before writing a permission record.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
