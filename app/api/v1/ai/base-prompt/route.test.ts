import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBooksPermissionMock } = vi.hoisted(() => ({
  requireBooksPermissionMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

const { GET } = await import("./route");

function getRequest(query: string) {
  return new Request(`http://localhost/api/v1/ai/base-prompt?${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  requireBooksPermissionMock.mockResolvedValue({ ok: true });
});

describe("GET /api/v1/ai/base-prompt", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await GET(getRequest("task=assist.title"));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
  });

  it("returns the default base prompt for a known task", async () => {
    const response = await GET(getRequest("task=translate.plain"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.prompt).toMatch(/Translate/);
  });

  it("uses the requested language for language-parameterized prompts", async () => {
    const response = await GET(
      getRequest("task=assist.bookDescription&language=en"),
    );
    const body = await response.json();

    expect(body.data.prompt).toMatch(/in English/);
  });

  it("returns 400 for an unknown task or an invalid language", async () => {
    expect((await GET(getRequest("task=nope"))).status).toBe(400);
    expect((await GET(getRequest(""))).status).toBe(400);
    expect(
      (await GET(getRequest("task=assist.title&language=fr"))).status,
    ).toBe(400);
  });
});
