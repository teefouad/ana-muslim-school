import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBooksPermissionMock, generateQuestionsServiceMock } = vi.hoisted(
  () => ({
    requireBooksPermissionMock: vi.fn(),
    generateQuestionsServiceMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth/require-books-permission", () => ({
  requireBooksPermission: requireBooksPermissionMock,
}));

vi.mock("@/lib/ai/generate-questions-service", () => ({
  generateQuestionsService: generateQuestionsServiceMock,
}));

const { POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/ai/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SAMPLE_QUESTIONS = [
  {
    text: "سؤال؟",
    explanation: "شرح",
    choices: [
      { text: "خطأ", isCorrect: false },
      { text: "صحيح", isCorrect: true },
    ],
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/v1/ai/generate-questions", () => {
  it("requires the update permission", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const response = await POST(jsonRequest({ sourceText: "نص", count: 5 }));

    expect(response.status).toBe(403);
    expect(requireBooksPermissionMock).toHaveBeenCalledWith("update");
    expect(generateQuestionsServiceMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid (non-JSON-object) request body", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
    expect(generateQuestionsServiceMock).not.toHaveBeenCalled();
  });

  it("delegates the parsed body to the service and returns its data", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    generateQuestionsServiceMock.mockResolvedValueOnce({
      ok: true,
      value: { questions: SAMPLE_QUESTIONS },
    });

    const response = await POST(
      jsonRequest({
        sourceText: "نص المصدر",
        count: 5,
        additionalInstructions: "ركز على الفقرة الأولى",
      }),
    );
    const body = await response.json();

    expect(generateQuestionsServiceMock).toHaveBeenCalledWith({
      sourceText: "نص المصدر",
      count: 5,
      additionalInstructions: "ركز على الفقرة الأولى",
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { questions: SAMPLE_QUESTIONS } });
  });

  it("maps a service failure to its HTTP status", async () => {
    requireBooksPermissionMock.mockResolvedValueOnce({
      ok: true,
      actorEmail: "a@example.com",
    });
    generateQuestionsServiceMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "invalid-input",
        message: "`sourceText` must be a non-empty string.",
      },
    });

    const response = await POST(jsonRequest({ sourceText: "", count: 5 }));

    expect(response.status).toBe(400);
  });
});
