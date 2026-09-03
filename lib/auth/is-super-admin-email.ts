import "server-only";

/**
 * The super-admin email is compared case-insensitively since email
 * addresses aren't case-sensitive and Firebase normalizes case
 * inconsistently across providers (e.g. Google vs. password sign-in).
 *
 * Kept in its own module (no firebase-admin dependency) so it can be unit
 * tested without initializing the Admin SDK.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  return Boolean(
    email &&
    superAdminEmail &&
    email.toLowerCase() === superAdminEmail.toLowerCase(),
  );
}
