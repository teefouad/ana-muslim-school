import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestOcr,
  requestOcrUploadUrl,
  uploadPdfToStorage,
} from "./ocr-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("requestOcrUploadUrl", () => {
  it("POSTs to /api/v1/sources/ocr/upload-url and returns the signed URL/objectPath", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: { uploadUrl: "https://storage/signed", objectPath: "tmp/a.pdf" },
      }),
    );

    const result = await requestOcrUploadUrl();

    expect(fetch).toHaveBeenCalledWith("/api/v1/sources/ocr/upload-url", {
      method: "POST",
    });
    expect(result).toEqual({
      uploadUrl: "https://storage/signed",
      objectPath: "tmp/a.pdf",
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Forbidden." }, 403),
    );

    await expect(requestOcrUploadUrl()).rejects.toThrow("Forbidden.");
  });
});

describe("uploadPdfToStorage", () => {
  it("PUTs the file directly to the signed URL with an application/pdf content type", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const file = new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" });

    await uploadPdfToStorage("https://storage/signed", file);

    expect(fetch).toHaveBeenCalledWith("https://storage/signed", {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
  });

  it("throws on a failed upload", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(
      uploadPdfToStorage("https://storage/signed", new File([], "a.pdf")),
    ).rejects.toThrow("Could not upload the PDF. Please try again.");
  });
});

describe("requestOcr", () => {
  it("POSTs the objectPath and 1-based pages to /api/v1/sources/ocr", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: { model: "m", pagesProcessed: 1, docSizeBytes: null, pages: [] },
      }),
    );

    await requestOcr("tmp/a.pdf", [1, 3]);

    expect(fetch).toHaveBeenCalledWith("/api/v1/sources/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPath: "tmp/a.pdf", pages: [1, 3] }),
    });
  });

  it("throws the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "The PDF exceeds the 100 MB size limit." }, 413),
    );

    await expect(requestOcr("tmp/a.pdf", [1])).rejects.toThrow(
      "The PDF exceeds the 100 MB size limit.",
    );
  });
});
