"use client";

import dynamic from "next/dynamic";

import type { PdfViewerProps } from "./pdf-viewer-core";

export type { PdfViewerProps } from "./pdf-viewer-core";

// pdf.js touches browser-only APIs during module init and has no SSR
// support, so it's loaded only on the client -- same next/dynamic
// ({ ssr: false }) pattern as components/ui/markdown-editor.tsx.
const PdfViewerCore = dynamic(() => import("./pdf-viewer-core"), {
  ssr: false,
});

export function PdfViewer(props: PdfViewerProps) {
  return <PdfViewerCore {...props} />;
}
