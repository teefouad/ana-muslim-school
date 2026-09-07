import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requireBooksPermissionMock,
  getSessionUserMock,
  createOcrUploadUrlServiceMock,
} = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  createOcrUploadUrlServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/sources/ocr-service", () => ({
  createOcrUploadUrlService: createOcrUploadUrlServiceMock,
}));

const { POST } = await import("./route");

function allow() {
  requireBooksPermissionMock.mockResolvedValueOnce({
    ok: true,
    actorEmail: "admin@example.com",
  });
  getSessionUserMock.mockResolvedValueOnce({
    uid: "user-1",
    email: "admin@example.com",
  });
}

function deny() {
  requireBooksPermissionMock.mockResolvedValueOnce({
    ok: false,
    response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/v1/sources/ocr/upload-url", () => {
  it("requires books.update", async () => {
    deny();

    const response = await POST();

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(createOcrUploadUrlServiceMock).not.toHaveBeenCalled();
  });

  it("passes the authenticated user's uid to the service and returns its result", async () => {
    allow();
    createOcrUploadUrlServiceMock.mockResolvedValueOnce({
      ok: true,
      value: {
        uploadUrl: "https://storage/signed",
        objectPath: "tmp/ocr-uploads/user-1/a.pdf",
      },
    });

    const response = await POST();

    expect(createOcrUploadUrlServiceMock).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        uploadUrl: "https://storage/signed",
        objectPath: "tmp/ocr-uploads/user-1/a.pdf",
      },
    });
  });

  it("maps a service failure to the equivalent HTTP status", async () => {
    allow();
    createOcrUploadUrlServiceMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "upstream-error",
        message: "Could not prepare the upload. Please try again.",
      },
    });

    const response = await POST();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Could not prepare the upload. Please try again.",
    });
  });
});
