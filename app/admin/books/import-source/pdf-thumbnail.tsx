"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Check } from "lucide-react";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { PdfPageCanvas } from "./pdf-page-canvas";
import styles from "./pdf-thumbnail.module.css";

const THUMBNAIL_WIDTH = 144;

export interface PdfThumbnailProps {
  doc: PdfDocument;
  pageNumber: number;
  /** True for the page currently shown in the main preview -- distinct from
   * `isSelected`, per ANA-68 (clicking a thumbnail previews it without
   * changing its selection). */
  isPreviewed: boolean;
  isSelected: boolean;
  onPreview: () => void;
  onToggleSelect: (options: { shiftKey: boolean }) => void;
}

export function PdfThumbnail({
  doc,
  pageNumber,
  isPreviewed,
  isSelected,
  onPreview,
  onToggleSelect,
}: PdfThumbnailProps) {
  function handleCheckboxClick(event: MouseEvent) {
    event.stopPropagation();
    onToggleSelect({ shiftKey: event.shiftKey });
  }

  function handleCheckboxKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onToggleSelect({ shiftKey: event.shiftKey });
    }
  }

  return (
    <div
      className={[
        styles.thumbnail,
        isPreviewed && styles.previewed,
        isSelected && styles.selected,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={styles.imageButton}
        onClick={onPreview}
        aria-label={`Preview page ${pageNumber}`}
      >
        <PdfPageCanvas
          doc={doc}
          pageNumber={pageNumber}
          targetWidth={THUMBNAIL_WIDTH}
        />
      </button>
      <div
        role="checkbox"
        tabIndex={0}
        aria-checked={isSelected}
        aria-label={`Select page ${pageNumber}`}
        className={[styles.checkbox, isSelected && styles.checkboxSelected]
          .filter(Boolean)
          .join(" ")}
        onClick={handleCheckboxClick}
        onKeyDown={handleCheckboxKeyDown}
      >
        {isSelected && <Check size={14} aria-hidden="true" />}
      </div>
      <p className={styles.pageNumber}>{pageNumber}</p>
    </div>
  );
}
