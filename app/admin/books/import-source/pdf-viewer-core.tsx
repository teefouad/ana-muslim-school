"use client";

import { useState } from "react";
import { Alert, Button, Loader, Text } from "@mantine/core";
import { ArrowRight } from "lucide-react";

import { PdfPageCanvas } from "./pdf-page-canvas";
import { PdfThumbnailStrip } from "./pdf-thumbnail-strip";
import { PdfViewerToolbar } from "./pdf-viewer-toolbar";
import { usePdfDocument } from "./use-pdf-document";
import styles from "./pdf-viewer.module.css";

const BASE_PAGE_WIDTH = 640;
const DEFAULT_ZOOM_PERCENT = 100;

export interface PdfViewerProps {
  file: File;
  selectedPages: Set<number>;
  onSelectedPagesChange: (pages: Set<number>) => void;
  onChooseDifferentFile: () => void;
  onRunOcr: (pages: number[]) => void;
  isRunningOcr: boolean;
  ocrError: string | null;
}

// Step 2 of the Import Source modal (ANA-68): the PDF viewer/page-selection
// workspace. Default-exported so `pdf-viewer.tsx` can lazy-load it via
// `next/dynamic({ ssr: false })` -- pdf.js (loaded through usePdfDocument)
// touches browser-only APIs at module init and has no SSR support (see
// components/README.md's "Client-only dependencies" convention, already
// used by components/ui/markdown-editor.tsx).
export default function PdfViewer({
  file,
  selectedPages,
  onSelectedPagesChange,
  onChooseDifferentFile,
  onRunOcr,
  isRunningOcr,
  ocrError,
}: PdfViewerProps) {
  const { doc, numPages, isLoading, error } = usePdfDocument(file);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT);

  function handlePageChange(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), numPages || 1));
  }

  function handleSelectAll() {
    onSelectedPagesChange(
      new Set(Array.from({ length: numPages }, (_, index) => index + 1)),
    );
  }

  function handleClearSelection() {
    onSelectedPagesChange(new Set());
  }

  function handleRunOcr() {
    onRunOcr(Array.from(selectedPages).sort((a, b) => a - b));
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <div className={styles.centeredState}>
          <Alert color="red" role="alert" title="Could not open this PDF">
            {error}
            <Button variant="default" mt="md" onClick={onChooseDifferentFile}>
              Choose a different file
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  if (isLoading || !doc) {
    return (
      <div className={styles.shell}>
        <div className={styles.centeredState}>
          <Loader size="sm" />
        </div>
      </div>
    );
  }

  const selectedCount = selectedPages.size;

  return (
    <div className={styles.shell}>
      <PdfViewerToolbar
        fileName={file.name}
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={handlePageChange}
        zoomPercent={zoomPercent}
        onZoomChange={setZoomPercent}
        onChooseDifferentFile={onChooseDifferentFile}
      />
      <div className={styles.body}>
        <div className={styles.mainArea}>
          <PdfPageCanvas
            doc={doc}
            pageNumber={currentPage}
            targetWidth={(BASE_PAGE_WIDTH * zoomPercent) / 100}
            lazy={false}
            className={styles.pageWrapper}
          />
        </div>
        <PdfThumbnailStrip
          doc={doc}
          numPages={numPages}
          previewedPage={currentPage}
          selectedPages={selectedPages}
          onPreviewPage={setCurrentPage}
          onSelectedPagesChange={onSelectedPagesChange}
        />
      </div>
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <Text size="sm">
            {selectedCount} of {numPages} {numPages === 1 ? "page" : "pages"}{" "}
            selected
          </Text>
          <Button variant="subtle" size="xs" onClick={handleSelectAll}>
            Select all
          </Button>
          <Button
            variant="subtle"
            size="xs"
            disabled={selectedCount === 0}
            onClick={handleClearSelection}
          >
            Clear selection
          </Button>
          {ocrError && (
            <Text size="sm" c="red" role="alert">
              {ocrError}
            </Text>
          )}
        </div>
        <Button
          rightSection={<ArrowRight size={16} aria-hidden="true" />}
          disabled={selectedCount === 0}
          loading={isRunningOcr}
          onClick={handleRunOcr}
        >
          Run OCR
        </Button>
      </div>
    </div>
  );
}
