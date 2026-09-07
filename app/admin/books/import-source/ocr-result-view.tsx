"use client";

import dynamic from "next/dynamic";

import type { OcrResultViewProps } from "./ocr-result-view-core";

export type { OcrResultViewProps } from "./ocr-result-view-core";

// pdf.js (via usePdfDocument, used here to render each page's preview)
// touches browser-only APIs during module init and has no SSR support, so
// it's loaded only on the client -- same next/dynamic({ ssr: false })
// pattern as pdf-viewer.tsx / components/ui/markdown-editor.tsx.
const OcrResultViewCore = dynamic(() => import("./ocr-result-view-core"), {
  ssr: false,
});

export function OcrResultView(props: OcrResultViewProps) {
  return <OcrResultViewCore {...props} />;
}
