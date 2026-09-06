import { readErrorMessage } from "../fetch-json";
import type { OcrResult } from "@/lib/sources/ocr-types";

/** Requests a short-lived signed Firebase Storage upload URL from
 * `POST /api/v1/sources/ocr/upload-url` (ANA-68). */
export async function requestOcrUploadUrl(): Promise<{
  uploadUrl: string;
  objectPath: string;
}> {
  const response = await fetch("/api/v1/sources/ocr/upload-url", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as {
    data: { uploadUrl: string; objectPath: string };
  };

  return data;
}

/** Uploads the chosen PDF directly to Firebase Storage via the signed URL --
 * never through a normal Next.js request body (ANA-68). */
export async function uploadPdfToStorage(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Could not upload the PDF. Please try again.");
  }
}

/** Runs OCR on the selected 1-based pages of the previously uploaded PDF via
 * `POST /api/v1/sources/ocr` (ANA-68). */
export async function requestOcr(
  objectPath: string,
  pages: number[],
): Promise<OcrResult> {
  const response = await fetch("/api/v1/sources/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectPath, pages }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: OcrResult };

  return data;
}
