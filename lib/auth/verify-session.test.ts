import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookieMock } = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
}));

const { verifySessionCookie } = await import("./verify-session");

describe("verifySessionCookie", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when there is no cookie", async () => {
    expect(await verifySessionCookie(undefined)).toBeNull();
    expect(verifySessionCookieMock).not.toHaveBeenCalled();
  });

  it("returns null when the cookie fails verification", async () => {
    verifySessionCookieMock.mockRejectedValueOnce(new Error("invalid cookie"));
    expect(await verifySessionCookie("bad-cookie")).toBeNull();
  });

  it("returns the authenticated user for any valid cookie, regardless of super-admin status", async () => {
    verifySessionCookieMock.mockResolvedValueOnce({
      uid: "1",
      email: "someone-else@example.com",
    });
    expect(await verifySessionCookie("valid-cookie")).toEqual({
      uid: "1",
      email: "someone-else@example.com",
    });
  });
});
