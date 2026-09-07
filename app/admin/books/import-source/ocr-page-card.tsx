"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Card, Textarea } from "@mantine/core";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import type { TextDirection } from "./import-source-types";
import { PdfPageCanvas } from "./pdf-page-canvas";
import styles from "./ocr-page-card.module.css";

const DEFAULT_PREVIEW_PERCENT = 50;
const MIN_PREVIEW_PERCENT = 15;
const MAX_PREVIEW_PERCENT = 85;
const KEYBOARD_STEP_PERCENT = 5;

function clampPreviewPercent(value: number): number {
  return Math.min(MAX_PREVIEW_PERCENT, Math.max(MIN_PREVIEW_PERCENT, value));
}

export interface OcrPageCardProps {
  doc: PdfDocument;
  pageNumber: number;
  markdown: string;
  onMarkdownChange: (value: string) => void;
  fontScale: number;
  direction: TextDirection;
}

// One reviewed OCR page (ANA-68): the original PDF page preview alongside
// its editable extracted Markdown, split by a draggable/keyboard-resizable
// vertical divider. The divider's drag state is plain event-driven
// (window pointermove/pointerup added from a pointerdown handler, removed
// on pointerup) rather than effect-driven, so it never touches this repo's
// `react-hooks/set-state-in-effect` lint rule.
export function OcrPageCard({
  doc,
  pageNumber,
  markdown,
  onMarkdownChange,
  fontScale,
  direction,
}: OcrPageCardProps) {
  const [previewPercent, setPreviewPercent] = useState(DEFAULT_PREVIEW_PERCENT);
  const rowRef = useRef<HTMLDivElement>(null);
  const endDragRef = useRef<(() => void) | null>(null);

  // Cleanup-only effect (no state update) -- if this card unmounts (e.g.
  // "Back to page selection"/"Create Modules" clicked) mid-drag, this
  // removes the window-level pointermove/pointerup listeners below rather
  // than leaking them.
  useEffect(() => {
    return () => {
      endDragRef.current?.();
    };
  }, []);

  function handleHandlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const row = rowRef.current;

    if (!row) {
      return;
    }

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const rect = row!.getBoundingClientRect();
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setPreviewPercent(clampPreviewPercent(percent));
    }

    function endDrag() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      endDragRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    endDragRef.current = endDrag;
  }

  function handleHandleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPreviewPercent((prev) =>
        clampPreviewPercent(prev - KEYBOARD_STEP_PERCENT),
      );
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPreviewPercent((prev) =>
        clampPreviewPercent(prev + KEYBOARD_STEP_PERCENT),
      );
    }
  }

  return (
    <Card withBorder padding="md" radius="md">
      <p className={styles.label}>Page {pageNumber}</p>
      <div ref={rowRef} className={styles.row}>
        <div
          className={styles.previewColumn}
          style={{ width: `${previewPercent}%` }}
        >
          <PdfPageCanvas
            doc={doc}
            pageNumber={pageNumber}
            fitToContainer
            className={styles.previewCanvas}
          />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize page ${pageNumber} preview`}
          aria-valuenow={Math.round(previewPercent)}
          aria-valuemin={MIN_PREVIEW_PERCENT}
          aria-valuemax={MAX_PREVIEW_PERCENT}
          tabIndex={0}
          className={styles.handle}
          onPointerDown={handleHandlePointerDown}
          onKeyDown={handleHandleKeyDown}
        >
          <div className={styles.handleBar} />
        </div>
        <div
          className={styles.textColumn}
          style={{ width: `${100 - previewPercent}%` }}
        >
          <Textarea
            value={markdown}
            onChange={(event) => onMarkdownChange(event.currentTarget.value)}
            placeholder="No text was extracted from this page."
            dir={direction}
            aria-label={`Extracted text for page ${pageNumber}`}
            className={styles.textareaRoot}
            classNames={{ wrapper: styles.textareaWrapper }}
            styles={{
              input: {
                flex: 1,
                minHeight: 0,
                height: "100%",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: `${14 * (fontScale / 100)}px`,
                lineHeight: 1.6,
                padding: 12,
                resize: "vertical",
              },
            }}
          />
        </div>
      </div>
    </Card>
  );
}
