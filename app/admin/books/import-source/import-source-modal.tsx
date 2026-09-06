"use client";

import { useState } from "react";
import { Modal } from "@mantine/core";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule, TextDirection } from "./import-source-types";
import { ModuleBuilderView } from "./module-builder-view";
import { OcrResultView } from "./ocr-result-view";
import { PdfFilePicker } from "./pdf-file-picker";
import { PdfViewer } from "./pdf-viewer";
import { useOcrRun } from "./use-ocr-run";
import styles from "./import-source-modal.module.css";

type Step = "pick" | "select-pages" | "review-ocr" | "build-modules";

export interface ImportSourceModalProps {
  /** The modal is open whenever this is true. Only a persisted Book can
   * open the flow -- callers are responsible for keeping the triggering
   * "Import Source" button disabled until a real `bookId` exists. */
  opened: boolean;
  onClose: () => void;
  /** The Book this import belongs to. Required so this component's props
   * only make sense wired to a real, persisted Book, even though nothing in
   * this card's temporary workflow state is sent to the server keyed by it
   * yet -- a later card wires the reviewed source text and Modules into
   * `/api/v1/books/{bookId}/modules` (see AGENTS.md's persistence
   * boundary). */
  bookId: string;
}

// The full PDF -> page selection -> Mistral OCR review -> Module-building
// workflow (ANA-68). Owns every piece of workflow state itself -- opening
// the modal never touches the Book form, and closing it always discards
// this state (see resetState/handleClose below) so reopening always starts
// from the PDF picker again. No route navigation is involved; the whole
// workflow stays inside this modal.
export function ImportSourceModal({ opened, onClose }: ImportSourceModalProps) {
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editedMarkdown, setEditedMarkdown] = useState<Record<number, string>>(
    {},
  );
  const [fontScale, setFontScale] = useState(100);
  // Arabic is the primary content language for this School's sources.
  const [direction, setDirection] = useState<TextDirection>("rtl");
  const [modules, setModules] = useState<TempModule[]>([]);
  const ocrRun = useOcrRun();

  function resetState() {
    setStep("pick");
    setFile(null);
    setSelectedPages(new Set());
    setOcrResult(null);
    setEditedMarkdown({});
    setFontScale(100);
    setDirection("rtl");
    setModules([]);
    ocrRun.invalidate();
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileSelected(nextFile: File) {
    ocrRun.invalidate();
    setFile(nextFile);
    setSelectedPages(new Set());
    setStep("select-pages");
  }

  function handleChooseDifferentFile() {
    ocrRun.invalidate();
    setFile(null);
    setSelectedPages(new Set());
    setStep("pick");
  }

  function handleRunOcr(pages: number[]) {
    if (!file) {
      return;
    }

    ocrRun.run(file, pages, (result) => {
      setOcrResult(result);
      setEditedMarkdown(
        Object.fromEntries(result.pages.map((p) => [p.pageNumber, p.markdown])),
      );
      setStep("review-ocr");
    });
  }

  function handleBackToPageSelection() {
    setStep("select-pages");
  }

  function handleCreateModules() {
    setStep("build-modules");
  }

  function handleBackToReview() {
    setStep("review-ocr");
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Import Source"
      classNames={{ content: styles.content, body: styles.body }}
      centered
    >
      {step === "pick" && <PdfFilePicker onFileSelected={handleFileSelected} />}

      {step === "select-pages" && file && (
        <PdfViewer
          file={file}
          selectedPages={selectedPages}
          onSelectedPagesChange={setSelectedPages}
          onChooseDifferentFile={handleChooseDifferentFile}
          onRunOcr={handleRunOcr}
          isRunningOcr={ocrRun.state.status === "running"}
          ocrError={
            ocrRun.state.status === "error" ? ocrRun.state.message : null
          }
        />
      )}

      {step === "review-ocr" && ocrResult && file && (
        <OcrResultView
          file={file}
          ocrResult={ocrResult}
          editedMarkdown={editedMarkdown}
          onEditedMarkdownChange={setEditedMarkdown}
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
          direction={direction}
          onDirectionChange={setDirection}
          onBack={handleBackToPageSelection}
          onCreateModules={handleCreateModules}
        />
      )}

      {step === "build-modules" && ocrResult && file && (
        <ModuleBuilderView
          fileName={file.name}
          ocrResult={ocrResult}
          editedMarkdown={editedMarkdown}
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
          direction={direction}
          onDirectionChange={setDirection}
          modules={modules}
          onModulesChange={setModules}
          onBack={handleBackToReview}
        />
      )}
    </Modal>
  );
}
