"use client";

import { useRef, useState } from "react";

import type { OcrResult } from "@/lib/sources/ocr-types";
import {
  requestOcr,
  requestOcrUploadUrl,
  uploadPdfToStorage,
} from "./ocr-client";

export type OcrRunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string };

/**
 * Owns the upload-url -> direct-upload -> OCR request chain for the Import
 * Source modal's "Run OCR" action (ANA-68).
 *
 * `activeFileRef` guards against a late response from an abandoned request
 * overwriting state for a newly selected file: `run` stamps the file it was
 * started for, and `invalidate` (called whenever the caller's selected file
 * changes or the modal closes) clears that stamp so an in-flight request
 * that resolves afterwards is silently dropped instead of calling
 * `onSuccess`/setting an error for a file that's no longer active.
 */
export function useOcrRun() {
  const [state, setState] = useState<OcrRunState>({ status: "idle" });
  const activeFileRef = useRef<File | null>(null);

  async function run(
    file: File,
    pages: number[],
    onSuccess: (result: OcrResult) => void,
  ) {
    activeFileRef.current = file;
    setState({ status: "running" });

    try {
      const { uploadUrl, objectPath } = await requestOcrUploadUrl();
      await uploadPdfToStorage(uploadUrl, file);
      const result = await requestOcr(objectPath, pages);

      if (activeFileRef.current !== file) {
        return;
      }

      setState({ status: "idle" });
      onSuccess(result);
    } catch (error) {
      if (activeFileRef.current !== file) {
        return;
      }

      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  function invalidate() {
    activeFileRef.current = null;
    setState({ status: "idle" });
  }

  return { state, run, invalidate };
}
