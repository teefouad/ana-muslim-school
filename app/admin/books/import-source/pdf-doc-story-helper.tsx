"use client";

import { useState, type ReactNode } from "react";
import { Loader } from "@mantine/core";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { createTestPdfFile } from "./pdf-test-fixtures";
import { usePdfDocument } from "./use-pdf-document";

/**
 * Storybook/test-only helper (not itself a component the app renders) that
 * loads the hand-built test PDF fixture and hands the resolved pdf.js
 * document to `children` -- lets stories for PdfPageCanvas/PdfThumbnail/
 * OcrPageCard/etc. render a real document without ever fetching anything or
 * calling Mistral.
 */
export function WithTestPdfDocument({
  pageCount = 5,
  children,
}: {
  pageCount?: number;
  children: (doc: PdfDocument, file: File) => ReactNode;
}) {
  const [file] = useState(() => createTestPdfFile(pageCount));
  const { doc, isLoading } = usePdfDocument(file);

  if (isLoading || !doc) {
    return <Loader size="sm" />;
  }

  return <>{children(doc, file)}</>;
}
