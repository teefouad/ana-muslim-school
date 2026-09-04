export type AccessStatus = "Active" | "Expired";

export function getAccessStatus(
  expiresAt: Date | null,
  now: Date = new Date(),
): AccessStatus {
  if (!expiresAt) {
    return "Active";
  }

  return expiresAt.getTime() < now.getTime() ? "Expired" : "Active";
}
