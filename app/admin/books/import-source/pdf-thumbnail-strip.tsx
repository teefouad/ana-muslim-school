"use client";

import { useState } from "react";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { PdfThumbnail } from "./pdf-thumbnail";
import styles from "./pdf-thumbnail-strip.module.css";

export interface PdfThumbnailStripProps {
  doc: PdfDocument;
  numPages: number;
  previewedPage: number;
  selectedPages: Set<number>;
  onPreviewPage: (page: number) => void;
  onSelectedPagesChange: (pages: Set<number>) => void;
}

export function PdfThumbnailStrip({
  doc,
  numPages,
  previewedPage,
  selectedPages,
  onPreviewPage,
  onSelectedPagesChange,
}: PdfThumbnailStripProps) {
  // The anchor for shift-click range selection -- only a plain (non-shift)
  // toggle sets it, so repeated shift-clicks all extend from the same
  // explicitly-clicked page rather than chaining off each other (ANA-68).
  const [anchor, setAnchor] = useState<number | null>(null);

  function handleToggleSelect(pageNumber: number, shiftKey: boolean) {
    const next = new Set(selectedPages);

    if (shiftKey && anchor !== null) {
      const [start, end] =
        anchor < pageNumber ? [anchor, pageNumber] : [pageNumber, anchor];

      for (let page = start; page <= end; page += 1) {
        next.add(page);
      }
    } else {
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }

      setAnchor(pageNumber);
    }

    onSelectedPagesChange(next);
  }

  return (
    <div className={styles.strip}>
      {Array.from({ length: numPages }, (_, index) => index + 1).map(
        (pageNumber) => (
          <PdfThumbnail
            key={pageNumber}
            doc={doc}
            pageNumber={pageNumber}
            isPreviewed={pageNumber === previewedPage}
            isSelected={selectedPages.has(pageNumber)}
            onPreview={() => onPreviewPage(pageNumber)}
            onToggleSelect={({ shiftKey }) =>
              handleToggleSelect(pageNumber, shiftKey)
            }
          />
        ),
      )}
    </div>
  );
}
