"use client";

import { Button, Group, Loader, Stack } from "@mantine/core";
import { ArrowLeft, ArrowRight } from "lucide-react";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TextDirection } from "./import-source-types";
import { DocumentSummary } from "./document-summary";
import { FontSizeControl } from "./font-size-control";
import { OcrPageCard } from "./ocr-page-card";
import { TextDirectionControl } from "./text-direction-control";
import { usePdfDocument } from "./use-pdf-document";
import styles from "./ocr-result-view.module.css";

export interface OcrResultViewProps {
  /** The original PDF that was OCR'd -- its page numbers line up 1:1 with
   * `ocrResult.pages[].pageNumber`, and each page card renders its own
   * preview from this same document. */
  file: File;
  ocrResult: OcrResult;
  editedMarkdown: Record<number, string>;
  onEditedMarkdownChange: (value: Record<number, string>) => void;
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
  onBack: () => void;
  onCreateModules: () => void;
}

// Step 3 of the Import Source modal (ANA-68): the OCR result review
// workspace. Default-exported so `ocr-result-view.tsx` can lazy-load it via
// `next/dynamic({ ssr: false })` -- see pdf-viewer-core.tsx for why.
export default function OcrResultView({
  file,
  ocrResult,
  editedMarkdown,
  onEditedMarkdownChange,
  fontScale,
  onFontScaleChange,
  direction,
  onDirectionChange,
  onBack,
  onCreateModules,
}: OcrResultViewProps) {
  const { doc, isLoading } = usePdfDocument(file);

  function handlePageMarkdownChange(pageNumber: number, value: string) {
    onEditedMarkdownChange({ ...editedMarkdown, [pageNumber]: value });
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <DocumentSummary fileName={file.name} ocrResult={ocrResult} />
        <Group gap="sm">
          <FontSizeControl value={fontScale} onChange={onFontScaleChange} />
          <TextDirectionControl
            value={direction}
            onChange={onDirectionChange}
          />
        </Group>
      </div>

      <div className={styles.body}>
        {isLoading || !doc ? (
          <div className={styles.centeredState}>
            <Loader size="sm" />
          </div>
        ) : (
          <Stack gap="md">
            {ocrResult.pages.map((page) => (
              <OcrPageCard
                key={page.pageNumber}
                doc={doc}
                pageNumber={page.pageNumber}
                markdown={editedMarkdown[page.pageNumber] ?? page.markdown}
                onMarkdownChange={(value) =>
                  handlePageMarkdownChange(page.pageNumber, value)
                }
                fontScale={fontScale}
                direction={direction}
              />
            ))}
          </Stack>
        )}
      </div>

      <div className={styles.footer}>
        <Button
          variant="default"
          leftSection={<ArrowLeft size={16} aria-hidden="true" />}
          onClick={onBack}
        >
          Back to page selection
        </Button>
        <Button
          rightSection={<ArrowRight size={16} aria-hidden="true" />}
          onClick={onCreateModules}
        >
          Create Modules
        </Button>
      </div>
    </div>
  );
}
