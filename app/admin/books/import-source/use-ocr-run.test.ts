import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestOcrUploadUrlMock, uploadPdfToStorageMock, requestOcrMock } =
  vi.hoisted(() => ({
    requestOcrUploadUrlMock: vi.fn(),
    uploadPdfToStorageMock: vi.fn(),
    requestOcrMock: vi.fn(),
  }));

vi.mock("./ocr-client", () => ({
  requestOcrUploadUrl: requestOcrUploadUrlMock,
  uploadPdfToStorage: uploadPdfToStorageMock,
  requestOcr: requestOcrMock,
}));

const { useOcrRun } = await import("./use-ocr-run");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeFile(name = "a.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useOcrRun", () => {
  it("requests an upload URL, uploads the PDF, then runs OCR with the given pages", async () => {
    requestOcrUploadUrlMock.mockResolvedValue({
      uploadUrl: "https://storage.example/signed",
      objectPath: "tmp/ocr-uploads/user-1/a.pdf",
    });
    uploadPdfToStorageMock.mockResolvedValue(undefined);
    requestOcrMock.mockResolvedValue({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 10,
      pages: [{ pageNumber: 1, markdown: "hi" }],
    });

    const { result } = renderHook(() => useOcrRun());
    const file = fakeFile();
    const onSuccess = vi.fn();

    await act(async () => {
      await result.current.run(file, [1, 2], onSuccess);
    });

    expect(requestOcrUploadUrlMock).toHaveBeenCalled();
    expect(uploadPdfToStorageMock).toHaveBeenCalledWith(
      "https://storage.example/signed",
      file,
    );
    expect(requestOcrMock).toHaveBeenCalledWith(
      "tmp/ocr-uploads/user-1/a.pdf",
      [1, 2],
    );
    expect(onSuccess).toHaveBeenCalledWith({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 10,
      pages: [{ pageNumber: 1, markdown: "hi" }],
    });
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("sets an error state when the request chain fails", async () => {
    requestOcrUploadUrlMock.mockRejectedValue(new Error("upload url failed"));

    const { result } = renderHook(() => useOcrRun());
    const onSuccess = vi.fn();

    await act(async () => {
      await result.current.run(fakeFile(), [1], onSuccess);
    });

    expect(result.current.state).toEqual({
      status: "error",
      message: "upload url failed",
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reports a running state while the request chain is in flight", async () => {
    const gate = deferred<{ uploadUrl: string; objectPath: string }>();
    requestOcrUploadUrlMock.mockReturnValue(gate.promise);

    const { result } = renderHook(() => useOcrRun());

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run(fakeFile(), [1], vi.fn());
    });

    expect(result.current.state).toEqual({ status: "running" });

    await act(async () => {
      gate.resolve({ uploadUrl: "u", objectPath: "p" });
      uploadPdfToStorageMock.mockResolvedValue(undefined);
      requestOcrMock.mockResolvedValue({
        model: "m",
        pagesProcessed: 1,
        docSizeBytes: null,
        pages: [],
      });
      await runPromise;
    });
  });

  it("ignores a late response for a file that's no longer active after invalidate()", async () => {
    const gate = deferred<{ uploadUrl: string; objectPath: string }>();
    requestOcrUploadUrlMock.mockReturnValue(gate.promise);

    const { result } = renderHook(() => useOcrRun());
    const onSuccess = vi.fn();

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run(fakeFile("old.pdf"), [1], onSuccess);
    });

    // The user chose a different file (or closed the modal) before the
    // first request resolved.
    act(() => {
      result.current.invalidate();
    });

    await act(async () => {
      gate.resolve({ uploadUrl: "u", objectPath: "p" });
      uploadPdfToStorageMock.mockResolvedValue(undefined);
      requestOcrMock.mockResolvedValue({
        model: "m",
        pagesProcessed: 1,
        docSizeBytes: null,
        pages: [],
      });
      await runPromise;
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("ignores a late response once a new run() has started for a different file", async () => {
    const firstGate = deferred<{ uploadUrl: string; objectPath: string }>();
    requestOcrUploadUrlMock.mockReturnValueOnce(firstGate.promise);

    const { result } = renderHook(() => useOcrRun());
    const firstOnSuccess = vi.fn();
    const secondOnSuccess = vi.fn();

    let firstRunPromise!: Promise<void>;
    act(() => {
      firstRunPromise = result.current.run(
        fakeFile("first.pdf"),
        [1],
        firstOnSuccess,
      );
    });

    requestOcrUploadUrlMock.mockResolvedValueOnce({
      uploadUrl: "u2",
      objectPath: "p2",
    });
    uploadPdfToStorageMock.mockResolvedValue(undefined);
    requestOcrMock.mockResolvedValue({
      model: "m",
      pagesProcessed: 1,
      docSizeBytes: null,
      pages: [],
    });

    await act(async () => {
      await result.current.run(fakeFile("second.pdf"), [1], secondOnSuccess);
    });

    expect(secondOnSuccess).toHaveBeenCalled();

    await act(async () => {
      firstGate.resolve({ uploadUrl: "u1", objectPath: "p1" });
      await firstRunPromise;
    });

    expect(firstOnSuccess).not.toHaveBeenCalled();
  });
});
