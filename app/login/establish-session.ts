/**
 * Exchanges a Firebase ID token for this app's httpOnly session cookie (see
 * app/api/auth/session/route.ts). Used both right after sign-in and to
 * refresh the cookie whenever the client SDK issues a new ID token that the
 * server-side session needs to catch up with (e.g. after a password change,
 * which invalidates previously issued tokens).
 */
export async function establishSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Something went wrong. Please try again.");
  }
}
