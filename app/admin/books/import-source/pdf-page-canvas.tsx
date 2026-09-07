"use client";

import { useEffect, useRef } from "react";

import {
  renderPdfPage,
  type PdfDocument,
  type RenderTask,
} from "@/lib/pdf/pdf-document";

export interface PdfPageCanvasProps {
  doc: PdfDocument;
  pageNumber: number;
  /** The rendered page width in CSS pixels -- the canvas is scaled from the
   * page's native size to exactly this width (see renderPdfPage). Ignored
   * (used only as the very first paint's width) when `fitToContainer` is
   * set. */
  targetWidth?: number;
  /** Renders at the container's current width instead of a fixed
   * `targetWidth`, re-rendering as that width changes (e.g. the OCR review
   * split divider being dragged). */
  fitToContainer?: boolean;
  /** When true (the default), rendering is deferred until the canvas
   * scrolls near the viewport via IntersectionObserver, so a long thumbnail
   * strip or page list never eagerly renders hundreds of PDF pages at
   * once. Set to false for the always-visible main preview. */
  lazy?: boolean;
  className?: string;
}

// A single rendered PDF page, shared by the main preview, the thumbnail
// strip, and the OCR review page cards (each at a different width/sizing
// strategy). Rendering is a plain imperative canvas draw with no React
// state involved -- deliberately so, since driving it from a stateful
// effect (e.g. an "isRendered" flag set from an IntersectionObserver/
// ResizeObserver callback registered inside a useEffect) would trip this
// repo's `react-hooks/set-state-in-effect` lint rule (see AGENTS.md).
export function PdfPageCanvas({
  doc,
  pageNumber,
  targetWidth,
  fitToContainer = false,
  lazy = true,
  className,
}: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas) {
      return;
    }

    // Degrade to eager rendering rather than throwing if IntersectionObserver
    // isn't available in this runtime (older browsers, non-browser test
    // environments without the vitest.setup.ts polyfill, etc.).
    const supportsLazyRendering =
      lazy && typeof IntersectionObserver !== "undefined";

    let cancelled = false;
    let hasBeenVisible = !supportsLazyRendering;
    let currentWidth = targetWidth ?? container?.clientWidth ?? 0;
    let activeRenderTask: RenderTask | null = null;

    function renderNow() {
      if (cancelled || !canvas || !hasBeenVisible || currentWidth <= 0) {
        return;
      }

      // pdf.js throws if render() is called again on a canvas with an
      // unsettled render in progress -- cancel any previous task first
      // (e.g. the OCR review split divider firing this repeatedly while
      // dragged, via the ResizeObserver below).
      activeRenderTask?.cancel();
      activeRenderTask = null;

      renderPdfPage(doc, pageNumber, canvas, currentWidth)
        .then((task) => {
          activeRenderTask = task;
          return task.promise;
        })
        .catch(() => {
          // A failed/cancelled render (document destroyed mid-flight while
          // switching files, or superseded by a newer render task above)
          // isn't worth surfacing as an error state -- the page simply
          // stays blank or shows its next successful render.
        });
    }

    let intersectionObserver: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;

    if (container) {
      if (supportsLazyRendering) {
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              hasBeenVisible = true;
              renderNow();
            }
          },
          { rootMargin: "200px" },
        );
        intersectionObserver.observe(container);
      }

      if (fitToContainer) {
        resizeObserver = new ResizeObserver((entries) => {
          const width = entries[0]?.contentRect.width;

          if (width && Math.abs(width - currentWidth) > 1) {
            currentWidth = width;
            renderNow();
          }
        });
        resizeObserver.observe(container);
      }
    }

    if (!supportsLazyRendering) {
      renderNow();
    }

    return () => {
      cancelled = true;
      activeRenderTask?.cancel();
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [doc, pageNumber, targetWidth, fitToContainer, lazy]);

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        data-testid={`pdf-page-canvas-${pageNumber}`}
        style={fitToContainer ? { width: "100%", height: "auto" } : undefined}
      />
    </div>
  );
}
