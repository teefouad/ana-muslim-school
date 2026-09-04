// Deliberately simple: good enough to reject obviously malformed input
// without the edge-case complexity of a fully RFC 5322-compliant pattern.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
