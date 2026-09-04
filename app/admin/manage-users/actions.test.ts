import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  isSuperAdminEmailMock,
  savePermissionRecordMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  isSuperAdminEmailMock: vi.fn(),
  savePermissionRecordMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
  isSuperAdminEmail: isSuperAdminEmailMock,
}));

vi.mock("@/lib/permissions/permissions", () => ({
  savePermissionRecord: savePermissionRecordMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

const { savePermission } = await import("./actions");
const initialSavePermissionState = { status: "idle" as const, message: null };

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("email", "Admin@Example.com");
  formData.set("booksRead", "on");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe("savePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      uid: "1",
      email: "super@example.com",
    });
    isSuperAdminEmailMock.mockReturnValue(true);
  });

  it("rejects the request when there is no authenticated session", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const result = await savePermission(
      initialSavePermissionState,
      buildFormData(),
    );

    expect(result.status).toBe("error");
    expect(savePermissionRecordMock).not.toHaveBeenCalled();
  });

  it("rejects the request when the authenticated account is not the super admin", async () => {
    isSuperAdminEmailMock.mockReturnValue(false);

    const result = await savePermission(
      initialSavePermissionState,
      buildFormData(),
    );

    expect(result.status).toBe("error");
    expect(savePermissionRecordMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without persisting anything", async () => {
    const result = await savePermission(
      initialSavePermissionState,
      buildFormData({ email: "not-an-email" }),
    );

    expect(result.status).toBe("error");
    expect(savePermissionRecordMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable expiration date/time", async () => {
    const result = await savePermission(
      initialSavePermissionState,
      buildFormData({ expiresAt: "not-a-date" }),
    );

    expect(result.status).toBe("error");
    expect(savePermissionRecordMock).not.toHaveBeenCalled();
  });

  it("normalizes the email, derives the actor from the session, and never trusts client-supplied identity", async () => {
    const result = await savePermission(
      initialSavePermissionState,
      buildFormData({
        booksCreate: "on",
        manageUsers: "on",
      }),
    );

    expect(savePermissionRecordMock).toHaveBeenCalledWith(
      {
        email: "admin@example.com",
        books: { read: true, create: true, update: false, delete: false },
        manageUsers: true,
        expiresAt: null,
      },
      "super@example.com",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/manage-users");
    expect(result.status).toBe("success");
    expect(result.message).toContain("admin@example.com");
  });

  it("parses a provided expiration date/time", async () => {
    await savePermission(
      initialSavePermissionState,
      buildFormData({ expiresAt: "2030-01-01T12:00" }),
    );

    const [input] = savePermissionRecordMock.mock.calls[0];
    expect(input.expiresAt).toBeInstanceOf(Date);
    expect(Number.isNaN(input.expiresAt.getTime())).toBe(false);
  });
});
