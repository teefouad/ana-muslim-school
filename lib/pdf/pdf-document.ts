"use client";

import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Next.js/webpack's asset-module URL pattern (the approach pdfjs-dist's own
// docs recommend for bundlers) -- copies the worker file into the client
// bundle and points the library at it, rather than relying on a CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type PdfDocument = PDFDocumentProxy;

/**
 * Parses a `File` (never uploaded anywhere -- this only runs client-side
 * against the in-memory bytes) into a pdf.js document. Thin, mockable
 * wrapper so components/tests/Storybook stories never call pdfjs-dist
 * directly (see use-pdf-document.ts).
 *
 * Deliberately does not expose a way to `destroy()` the underlying loading
 * task: `usePdfDocument` caches the resolved document in SWR keyed by the
 * file's identity, and both PdfViewer and OcrResultView load the *same*
 * file as the modal moves from page-selection to OCR review -- destroying
 * the document when the first consumer unmounts would break the second
 * consumer, which reads the same cached entry.
 */
export async function loadPdfDocument(file: File): Promise<PdfDocument> {
  const data = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data }).promise;
}

export type { RenderTask } from "pdfjs-dist";

/**
 * Starts rendering one page of an already-loaded document into `canvas`,
 * scaled so the page is exactly `targetWidth` CSS pixels wide. Used for both
 * the main preview and thumbnails (at different `targetWidth`s).
 *
 * Returns the pdf.js `RenderTask` (before it settles) rather than awaiting
 * it internally, so a caller that starts another render on the same canvas
 * before this one finishes (e.g. PdfPageCanvas's ResizeObserver firing
 * repeatedly while a split divider is dragged) can call `.cancel()` on the
 * previous task first -- pdf.js throws if `render()` is invoked again on a
 * canvas with an unsettled render in progress.
 */
export async function renderPdfPage(
  doc: PdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
) {
  const page = await doc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: targetWidth / baseViewport.width,
  });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  return page.render({ canvas, viewport });
}
