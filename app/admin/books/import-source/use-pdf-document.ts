"use client";

import useSWR from "swr";

import { loadPdfDocument, type PdfDocument } from "@/lib/pdf/pdf-document";

/**
 * Loads a `File` into a pdf.js document. Uses SWR (keyed by the file's own
 * identity, not a URL) rather than a plain `useEffect` + `setState`, per
 * this repo's client-side-data-fetching rule (AGENTS.md) -- the underlying
 * `react-hooks/set-state-in-effect` lint rule flags any state update
 * reachable from a function invoked inside an effect (including a
 * `.then()`/`.catch()` continuation), which a hand-rolled load-and-setState
 * effect here would trip just as much as a REST fetch would.
 *
 * The resolved document is intentionally never explicitly torn down here:
 * PdfViewer and OcrResultView both call this with the *same* `file` as the
 * Import Source modal moves from page-selection to OCR review, sharing this
 * one SWR-cached entry -- destroying it on the first consumer's unmount
 * would leave the second with a dead document.
 */
export function usePdfDocument(file: File) {
  const {
    data: doc,
    error,
    isLoading,
  } = useSWR(["pdf-document", file.name, file.size, file.lastModified], () =>
    loadPdfDocument(file),
  );

  return {
    doc: doc ?? null,
    numPages: doc?.numPages ?? 0,
    isLoading,
    error: error
      ? "Could not open this PDF. Please choose a different file."
      : null,
  };
}

export type { PdfDocument };
