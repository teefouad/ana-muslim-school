"use client";

import { useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";

import { useClampedStepper } from "./use-clamped-stepper";
import styles from "./pdf-viewer-toolbar.module.css";

const MIN_ZOOM_PERCENT = 50;
const MAX_ZOOM_PERCENT = 250;
const ZOOM_STEP_PERCENT = 25;

export interface PdfViewerToolbarProps {
  fileName: string;
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
  zoomPercent: number;
  onZoomChange: (percent: number) => void;
  onChooseDifferentFile: () => void;
}

// The PDF viewer's dark toolbar (ANA-68) -- stays dark regardless of
// dashboard theme, matching a document-editor chrome rather than the
// surrounding admin UI.
export function PdfViewerToolbar({
  fileName,
  currentPage,
  numPages,
  onPageChange,
  zoomPercent,
  onZoomChange,
  onChooseDifferentFile,
}: PdfViewerToolbarProps) {
  const pageInputRef = useRef<HTMLInputElement>(null);
  const zoomStepper = useClampedStepper(
    zoomPercent,
    { min: MIN_ZOOM_PERCENT, max: MAX_ZOOM_PERCENT, step: ZOOM_STEP_PERCENT },
    onZoomChange,
  );

  // The page input is deliberately uncontrolled (`key={currentPage}` resets
  // it to the new value whenever a page change is committed elsewhere --
  // prev/next, a thumbnail click) rather than synced via a `useValue` +
  // `useEffect`, which this repo's `react-hooks/set-state-in-effect` lint
  // rule would flag (see AGENTS.md).
  function commitPageInput() {
    const input = pageInputRef.current;

    if (!input) {
      return;
    }

    const parsed = Number(input.value);

    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= numPages) {
      if (parsed === currentPage) {
        input.value = String(currentPage);
      } else {
        onPageChange(parsed);
      }
    } else {
      input.value = String(currentPage);
    }
  }

  function handlePageInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <div className={styles.toolbar}>
      <span className={styles.filename} title={fileName}>
        {fileName}
      </span>

      <div className={styles.pageControls}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <input
          key={currentPage}
          ref={pageInputRef}
          defaultValue={currentPage}
          className={styles.pageInput}
          aria-label="Current page"
          inputMode="numeric"
          onBlur={commitPageInput}
          onKeyDown={handlePageInputKeyDown}
        />
        <span className={styles.pageOf}>/ {numPages}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Next page"
          disabled={currentPage >= numPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.fileControls}>
        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom out"
            disabled={!zoomStepper.canDecrement}
            onClick={zoomStepper.decrement}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className={styles.zoomLabel}>{zoomPercent}%</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom in"
            disabled={!zoomStepper.canIncrement}
            onClick={zoomStepper.increment}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.separator} />

        <button
          type="button"
          className={styles.chooseFileButton}
          onClick={onChooseDifferentFile}
        >
          <X size={16} aria-hidden="true" />
          Choose a different file
        </button>
      </div>
    </div>
  );
}
