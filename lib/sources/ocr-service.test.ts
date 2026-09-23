import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminStorageMock, getMistralClientMock, ocrProcessMock } =
  vi.hoisted(() => ({
    getAdminStorageMock: vi.fn(),
    getMistralClientMock: vi.fn(),
    ocrProcessMock: vi.fn(),
  }));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminStorage: getAdminStorageMock,
}));

vi.mock("./mistral-client", () => ({
  getMistralClient: getMistralClientMock,
}));

const { createOcrUploadUrlService, runOcrService } =
  await import("./ocr-service");

function makeFile(
  overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {},
) {
  return {
    getMetadata: vi.fn().mockResolvedValue([{ size: "1024" }]),
    getSignedUrl: vi.fn().mockResolvedValue(["https://storage.example/signed"]),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockStorage(file: ReturnType<typeof makeFile>) {
  getAdminStorageMock.mockReturnValue({
    bucket: () => ({ file: () => file }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  getMistralClientMock.mockReturnValue({ ocr: { process: ocrProcessMock } });
});

describe("createOcrUploadUrlService", () => {
  it("creates a user-scoped random object path and returns a signed PUT URL", async () => {
    const file = makeFile();
    mockStorage(file);

    const result = await createOcrUploadUrlService("user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.objectPath).toMatch(
      /^tmp\/ocr-uploads\/user-1\/[a-f0-9-]+\.pdf$/,
    );
    expect(result.value.uploadUrl).toBe("https://storage.example/signed");
    expect(file.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "write",
        contentType: "application/pdf",
      }),
    );
  });

  it("maps a Storage failure to upstream-error", async () => {
    const file = makeFile({
      getSignedUrl: vi.fn().mockRejectedValue(new Error("boom")),
    });
    mockStorage(file);

    const result = await createOcrUploadUrlService("user-1");

    expect(result).toEqual({
      ok: false,
      error: { code: "upstream-error", message: expect.any(String) },
    });
  });
});

describe("runOcrService", () => {
  const objectPath = "tmp/ocr-uploads/user-1/doc.pdf";

  it("rejects an objectPath that does not belong to the current user, without touching storage", async () => {
    const file = makeFile();
    mockStorage(file);

    const result = await runOcrService({
      uid: "user-1",
      objectPath: "tmp/ocr-uploads/someone-else/doc.pdf",
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid-input", message: expect.any(String) },
    });
    expect(file.getMetadata).not.toHaveBeenCalled();
  });

  it.each([
    ["not an array", "not-an-array"],
    ["an empty array", []],
    ["a non-integer page", [1.5]],
    ["a page below 1", [0]],
  ])(
    "rejects %s for pages, without touching storage",
    async (_label, pages) => {
      const file = makeFile();
      mockStorage(file);

      const result = await runOcrService({ uid: "user-1", objectPath, pages });

      expect(result.ok).toBe(false);
      expect(file.getMetadata).not.toHaveBeenCalled();
    },
  );

  it("maps a Storage misconfiguration (getAdminStorage throwing) to a structured failure instead of an unhandled exception", async () => {
    getAdminStorageMock.mockImplementation(() => {
      throw new Error(
        "Missing Firebase Storage bucket. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.",
      );
    });

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "upstream-error", message: expect.any(String) },
    });
  });

  it("rejects more than 1000 deduplicated pages", async () => {
    const file = makeFile();
    mockStorage(file);
    const pages = Array.from({ length: 1001 }, (_, i) => i + 1);

    const result = await runOcrService({ uid: "user-1", objectPath, pages });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid-input", message: expect.any(String) },
    });
  });

  it("fails closed when the temporary object does not exist", async () => {
    const notFoundError = Object.assign(new Error("not found"), {
      code: 404,
    });
    const file = makeFile({
      getMetadata: vi.fn().mockRejectedValue(notFoundError),
    });
    mockStorage(file);

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid-input", message: expect.any(String) },
    });
    expect(file.delete).toHaveBeenCalled();
  });

  it("rejects a file over the 100 MB size limit as too-large", async () => {
    const file = makeFile({
      getMetadata: vi
        .fn()
        .mockResolvedValue([{ size: String(101 * 1024 * 1024) }]),
    });
    mockStorage(file);

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "too-large", message: expect.any(String) },
    });
  });

  it("maps a Storage metadata/signed-url failure to upstream-error", async () => {
    const file = makeFile({
      getMetadata: vi.fn().mockRejectedValue(new Error("boom")),
    });
    mockStorage(file);

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "upstream-error", message: expect.any(String) },
    });
  });

  it("maps a missing Mistral configuration to a distinct, non-retryable message", async () => {
    const file = makeFile();
    mockStorage(file);
    getMistralClientMock.mockImplementation(() => {
      throw new Error("Missing Mistral credentials. Set MISTRAL_API_KEY.");
    });

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "upstream-error",
        message: "OCR is not configured. Please contact an administrator.",
      },
    });
    expect(file.delete).toHaveBeenCalled();
  });

  it("maps a Mistral provider failure to upstream-error and still deletes the temp object", async () => {
    const file = makeFile();
    mockStorage(file);
    ocrProcessMock.mockRejectedValue(new Error("provider down"));

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "upstream-error", message: expect.any(String) },
    });
    expect(file.delete).toHaveBeenCalled();
  });

  it("maps a Mistral 429 to rate-limited rather than the generic upstream-error", async () => {
    const file = makeFile();
    mockStorage(file);

    const rateLimitError = new Error("API error occurred: Status 429");
    Object.assign(rateLimitError, {
      statusCode: 429,
      body: '{"type":"rate_limited","code":"1300"}',
    });
    ocrProcessMock.mockRejectedValue(rateLimitError);

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [1],
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "rate-limited", message: expect.any(String) },
    });
    expect(file.delete).toHaveBeenCalled();
  });

  it("converts 1-based viewer pages to 0-based provider indexes, dedupes/sorts them, normalizes the response, and deletes the temp object", async () => {
    const file = makeFile({
      getMetadata: vi.fn().mockResolvedValue([{ size: "2048" }]),
    });
    mockStorage(file);
    ocrProcessMock.mockResolvedValue({
      model: "mistral-ocr-latest",
      pages: [
        { index: 2, markdown: "# Page 3" },
        { index: 0, markdown: "# Page 1" },
      ],
    });

    const result = await runOcrService({
      uid: "user-1",
      objectPath,
      pages: [3, 1, 1],
    });

    expect(ocrProcessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        document: {
          type: "document_url",
          documentUrl: "https://storage.example/signed",
        },
        pages: [0, 2],
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        model: "mistral-ocr-latest",
        pagesProcessed: 2,
        docSizeBytes: 2048,
        pages: [
          { pageNumber: 1, markdown: "# Page 1" },
          { pageNumber: 3, markdown: "# Page 3" },
        ],
      },
    });
    expect(file.delete).toHaveBeenCalled();
  });
});
