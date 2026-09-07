"use client";

import { useState } from "react";
import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { ModuleWritableFields } from "@/lib/modules/types";
import type { TempModule, TextDirection } from "./import-source-types";
import { LearningMaterialView } from "./learning-material-view";
import { ModuleBuilderView } from "./module-builder-view";
import { createModule } from "./modules-client";
import { OcrResultView } from "./ocr-result-view";
import { PdfFilePicker } from "./pdf-file-picker";
import { PdfViewer } from "./pdf-viewer";
import { useOcrRun } from "./use-ocr-run";
import styles from "./import-source-modal.module.css";

// Every temporary Module is created with these exact draft values (ANA-70)
// -- the import flow only has selected source text at this point, not
// Module metadata, and the Modules list's own `Module N` fallback already
// covers a blank title, so nothing here is invented from the source text.
const MODULE_DRAFT_DEFAULTS: ModuleWritableFields = {
  title: { ar: "", en: "" },
  description: { ar: "", en: "" },
  color: "",
  isLocked: false,
  isPublished: false,
};

type Step =
  | "pick"
  | "select-pages"
  | "review-ocr"
  | "build-modules"
  | "learning-material";

export interface ImportSourceModalProps {
  /** The modal is open whenever this is true. Only a persisted Book can
   * open the flow -- callers are responsible for keeping the triggering
   * "Import Source" button disabled until a real `bookId` exists. */
  opened: boolean;
  onClose: () => void;
  /** The Book this import belongs to -- Finish creates the temporary
   * Modules under it via `POST /api/v1/books/{bookId}/modules` (ANA-70).
   * The OCR source text and Learning Material Markdown are still never
   * sent to the server (see AGENTS.md's persistence boundary); only
   * Modules are persisted by this card. */
  bookId: string;
  /** Called once every temporary Module has been created successfully,
   * before the modal closes -- the caller's own Modules SWR data (Edit
   * Book's panel) should be revalidated here so the new Modules appear
   * immediately without a full-page reload. */
  onModulesCreated?: () => void;
}

// The full PDF -> page selection -> Mistral OCR review -> Module-building ->
// Learning Material workflow (ANA-68/ANA-69). Owns every piece of workflow
// state itself -- opening the modal never touches the Book form, and
// closing it always discards this state (see resetState/handleClose below)
// so reopening always starts from the PDF picker again. No route
// navigation is involved; the whole workflow stays inside this modal.
export function ImportSourceModal({
  opened,
  onClose,
  bookId,
  onModulesCreated,
}: ImportSourceModalProps) {
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
  const [learningMaterials, setLearningMaterials] = useState<
    Record<string, string>
  >({});
  // Temporary Module ids already persisted through POST
  // /api/v1/books/{bookId}/modules in this modal session -- a retry after a
  // partial failure (see handleFinish) skips these instead of re-creating
  // them. Reset alongside every other piece of workflow state, so a fresh
  // open of the modal always starts a fresh Finish session too.
  const [createdModuleIds, setCreatedModuleIds] = useState<Set<string>>(
    new Set(),
  );
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const ocrRun = useOcrRun();
  const isMobile = useMediaQuery("(max-width: 768px)", false);

  function resetState() {
    setStep("pick");
    setFile(null);
    setSelectedPages(new Set());
    setOcrResult(null);
    setEditedMarkdown({});
    setFontScale(100);
    setDirection("rtl");
    setModules([]);
    setLearningMaterials({});
    setCreatedModuleIds(new Set());
    setIsFinishing(false);
    setFinishError(null);
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
    // The source is being discarded entirely -- everything derived from it
    // (the old OCR result, its edited Markdown, any temporary Modules built
    // from that text, and any Learning Material drafted for them) belongs
    // to a document the user is leaving behind, so none of it should still
    // be there if they pick a new file and reach review/build-modules again.
    setOcrResult(null);
    setEditedMarkdown({});
    setModules([]);
    setLearningMaterials({});
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
      // A fresh OCR result (even for the same file, e.g. a different page
      // selection) replaces the source text Modules were built from --
      // without this, going Back -> Back to page selection -> Run OCR again
      // would carry Modules (and their Learning Material) built from the
      // previous extracted text into the Module builder for the new one.
      setModules([]);
      setLearningMaterials({});
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

  function handleCreateLearningMaterial() {
    setStep("learning-material");
  }

  function handleBackToModules() {
    setStep("build-modules");
  }

  async function handleFinish() {
    // Guards against a duplicate submission from repeated clicks while a
    // Finish operation is already running, in addition to the button's own
    // disabled-while-loading state (belt and suspenders against a fast
    // double-click landing before the re-render).
    if (isFinishing || modules.length === 0) {
      return;
    }

    setIsFinishing(true);
    setFinishError(null);

    // A running copy of createdModuleIds, updated as each Module succeeds
    // -- so that if a later Module fails, everything created before it is
    // still recorded (via the setState below) for the next retry to skip,
    // rather than only being recorded after the whole batch finishes.
    const created = new Set(createdModuleIds);

    try {
      // Sequential, not Promise.all: Modules must be created in the current
      // temporary Module order so the resulting Book.modules order (each
      // POST atomically appends its id) matches the order shown here.
      for (const tempModule of modules) {
        if (created.has(tempModule.id)) {
          continue;
        }

        await createModule(bookId, MODULE_DRAFT_DEFAULTS);
        created.add(tempModule.id);
        setCreatedModuleIds(new Set(created));
      }

      onModulesCreated?.();
      resetState();
      onClose();
    } catch (err) {
      setFinishError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      setIsFinishing(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Import Source"
      classNames={{ content: styles.content, body: styles.body }}
      // Near-full desktop width with normal dashboard margins still
      // visible: Mantine's own Modal.Inner reserves a *default* 5vw of
      // horizontal padding around Modal.Content regardless of `size`
      // (see Modal.css's `--modal-x-offset`), so a plain `size` override
      // alone still gets clamped back down to ~90vw by that padding.
      // `xOffset` shrinks that padding to a small fixed gutter that
      // matches the margin already baked into `size` below, instead of
      // stacking on top of it. `fullScreen` on narrow viewports matches
      // the card's "use essentially the full viewport" requirement and
      // is Mantine's own supported way to get there, rather than
      // re-deriving full-bleed sizing by hand.
      size={isMobile ? "100%" : "min(1800px, calc(100vw - 48px))"}
      xOffset={isMobile ? "0px" : "24px"}
      fullScreen={isMobile}
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
          onCreateLearningMaterial={handleCreateLearningMaterial}
        />
      )}

      {step === "learning-material" && file && (
        <LearningMaterialView
          fileName={file.name}
          modules={modules}
          learningMaterials={learningMaterials}
          onLearningMaterialsChange={setLearningMaterials}
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
          direction={direction}
          onDirectionChange={setDirection}
          onBack={handleBackToModules}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          finishError={finishError}
          backDisabled={createdModuleIds.size > 0}
        />
      )}
    </Modal>
  );
}
