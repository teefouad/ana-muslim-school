"use client";

import { useState } from "react";
import { Alert, Group, Loader, Modal, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import useSWR from "swr";

import { fetchJson } from "../fetch-json";
import type { OcrResult } from "@/lib/sources/ocr-types";
import type { Source } from "@/lib/sources/types";
import type { Module, ModuleWritableFields } from "@/lib/modules/types";
import type { Material } from "@/lib/materials/types";
import type {
  TempModule,
  TextDirection,
  WorkspaceModuleEntry,
} from "./import-source-types";
import { buildSourceContent } from "./build-source-content";
import { createMaterial, updateMaterial } from "./materials-client";
import { LearningMaterialView } from "./learning-material-view";
import { ModuleBuilderView } from "./module-builder-view";
import { createModule } from "./modules-client";
import { OcrResultView } from "./ocr-result-view";
import { PdfFilePicker } from "./pdf-file-picker";
import { PdfViewer } from "./pdf-viewer";
import { SavedSourceView } from "./saved-source-view";
import { createSource, deleteSource, updateSource } from "./sources-client";
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
   * "Create from PDF" button disabled until a real `bookId` exists. */
  opened: boolean;
  onClose: () => void;
  /** The Book this import belongs to -- Finish creates the temporary
   * Modules under it via `POST /api/v1/books/{bookId}/modules` (ANA-70),
   * then persists the reviewed Source and each Module's Learning Material
   * (ANA-71). This is also the key used to look up whether the Book
   * already has a saved Source when the modal opens. */
  bookId: string;
  /** Called once every temporary Module has been created successfully,
   * before the modal closes -- the caller's own Modules SWR data (Edit
   * Book's panel) should be revalidated here so the new Modules appear
   * immediately without a full-page reload. */
  onModulesCreated?: () => void;
}

// The full PDF -> page selection -> Mistral OCR review -> Module-building ->
// Learning Material -> persistence workflow (ANA-68/ANA-69/ANA-70/ANA-71).
// Owns every piece of workflow state itself -- opening the modal never
// touches the Book form, and closing it always discards this state (see
// resetState/handleClose below) so reopening always starts from the PDF
// picker again, unless the Book already has a saved Source (see the
// Source-by-bookId lookup below), in which case it opens straight on the
// saved-source view instead. No route navigation is involved; the whole
// workflow stays inside this modal.
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
  // Temporary Module id -> real persisted Module id (ANA-71) -- kept
  // explicit so a Learning Material is never attached to the wrong Module,
  // and so retrying Finish after a partial failure can still resolve the
  // real Module id for a Module created in an earlier attempt.
  const [moduleIdMap, setModuleIdMap] = useState<Record<string, string>>({});
  // The real Source id once Finish has persisted it in this modal session
  // (ANA-71) -- distinct from the SWR-derived `existingSource` below, which
  // is deliberately not refreshed until the whole Finish operation
  // succeeds (see handleFinish) so a Learning Material failure after the
  // Source is created doesn't flip the modal over to the saved-source view
  // mid-retry.
  const [sourceId, setSourceId] = useState<string | null>(null);
  // Temporary Module ids whose Learning Material has already been
  // persisted in this modal session -- a retry skips these too.
  const [materializedModuleIds, setMaterializedModuleIds] = useState<
    Set<string>
  >(new Set());
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [isRemovingSource, setIsRemovingSource] = useState(false);
  const [removeSourceError, setRemoveSourceError] = useState<string | null>(
    null,
  );
  // Saved-Source workspace (ANA-72): the id of the Source these are seeded
  // from -- `null` until the initial Modules/Materials fetch has been used
  // to populate the fields below once per modal-open session (see the
  // render-time seeding block, right after the SWR reads below). Compared
  // against `existingSource.id` rather than gated by a boolean so a
  // Select-Another-PDF -> re-upload -> different Source cycle within the
  // same mount reseeds instead of reusing a stale workspace.
  const [seededSourceId, setSeededSourceId] = useState<string | null>(null);
  const [workspaceContent, setWorkspaceContent] = useState("");
  const [workspaceEntries, setWorkspaceEntries] = useState<
    WorkspaceModuleEntry[]
  >([]);
  // Retry-safety bookkeeping for Save Changes, mirroring handleFinish's
  // createdModuleIds/moduleIdMap/materializedModuleIds below -- each is
  // updated the moment its own write succeeds so a retry after a partial
  // failure only re-sends what didn't yet land.
  const [savedWorkspaceSourceContent, setSavedWorkspaceSourceContent] =
    useState("");
  const [materialDocIdByModuleId, setMaterialDocIdByModuleId] = useState<
    Record<string, string>
  >({});
  const [savedMaterialContentByModuleId, setSavedMaterialContentByModuleId] =
    useState<Record<string, string>>({});
  const [createdWorkspaceModuleKeys, setCreatedWorkspaceModuleKeys] = useState<
    Set<string>
  >(new Set());
  const [workspaceModuleIdMap, setWorkspaceModuleIdMap] = useState<
    Record<string, string>
  >({});
  const [materializedWorkspaceModuleKeys, setMaterializedWorkspaceModuleKeys] =
    useState<Set<string>>(new Set());
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [saveWorkspaceError, setSaveWorkspaceError] = useState<string | null>(
    null,
  );
  const ocrRun = useOcrRun();
  const isMobile = useMediaQuery("(max-width: 768px)", false);

  // Whether this Book already has a saved Source (ANA-71) -- looked up via
  // the Book-filtered `GET /api/v1/sources?bookId=` (never the full
  // collection) with SWR, paused while the modal is closed. Cache persists
  // across opens/closes (this component stays mounted regardless of
  // `opened` -- see EditBookPage), so `mutateSource()` after a successful
  // Finish or a successful Remove immediately reflects on the next open.
  const sourceUrl = opened
    ? `/api/v1/sources?bookId=${encodeURIComponent(bookId)}`
    : null;
  const {
    data: sourceData,
    error: sourceLookupError,
    isLoading: sourceLookupLoading,
    mutate: mutateSource,
  } = useSWR<{ data: Source[] }>(sourceUrl, fetchJson);
  const existingSource = sourceData?.data[0] ?? null;

  // The Book's persisted Modules, in `Book.modules` order, and its
  // Materials (Book-filtered via `?bookId=`, never the full collection --
  // ANA-72) -- both only needed to render the saved-Source workspace on the
  // "pick" step, unlike the Source lookup above, which deliberately keeps
  // polling across every step (see the "ignores a background Source-lookup
  // update" test). Same SWR key as EditBookPage's own Modules read, so
  // opening this modal right after the Edit Book page has loaded doesn't
  // refetch, and `onModulesCreated` (that page's `mutateModules`)
  // revalidates the same cache entry this hook reads.
  const modulesUrl =
    step === "pick" && existingSource
      ? `/api/v1/books/${bookId}/modules`
      : null;
  const {
    data: workspaceModulesData,
    error: workspaceModulesError,
    mutate: mutateWorkspaceModules,
  } = useSWR<{ data: Module[] }>(modulesUrl, fetchJson);

  const materialsUrl =
    step === "pick" && existingSource
      ? `/api/v1/materials?bookId=${encodeURIComponent(bookId)}`
      : null;
  const {
    data: workspaceMaterialsData,
    error: workspaceMaterialsError,
    mutate: mutateWorkspaceMaterials,
  } = useSWR<{ data: Material[] }>(materialsUrl, fetchJson);

  // Seeds the editable workspace fields from the Modules/Materials fetch,
  // once per Source (React's documented "adjusting state when a prop
  // changes" pattern -- see react.dev/reference/react/useState#storing-information-from-previous-renders
  // -- rather than a useEffect, which this project's lint config flags any
  // state update inside as an error; see AGENTS.md). Runs during render
  // itself: React discards this in-progress render and re-runs the
  // component immediately once the state above is set, so by the time this
  // component actually paints, `workspaceContent`/`workspaceEntries`
  // already reflect the seeded values below.
  if (
    existingSource &&
    workspaceModulesData &&
    workspaceMaterialsData &&
    seededSourceId !== existingSource.id
  ) {
    const materialByModuleId = new Map(
      workspaceMaterialsData.data.map((material) => [
        material.moduleId,
        material,
      ]),
    );
    const initialMaterialDocIds: Record<string, string> = {};
    const initialMaterialContents: Record<string, string> = {};

    for (const material of workspaceMaterialsData.data) {
      initialMaterialDocIds[material.moduleId] = material.id;
      initialMaterialContents[material.moduleId] = material.content;
    }

    setSeededSourceId(existingSource.id);
    setWorkspaceContent(existingSource.content);
    setWorkspaceEntries(
      workspaceModulesData.data.map((module) => ({
        key: module.id,
        moduleId: module.id,
        material: materialByModuleId.get(module.id)?.content ?? "",
      })),
    );
    setSavedWorkspaceSourceContent(existingSource.content);
    setMaterialDocIdByModuleId(initialMaterialDocIds);
    setSavedMaterialContentByModuleId(initialMaterialContents);
    setCreatedWorkspaceModuleKeys(new Set());
    setWorkspaceModuleIdMap({});
    setMaterializedWorkspaceModuleKeys(new Set());
    setSaveWorkspaceError(null);
  }

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
    setModuleIdMap({});
    setSourceId(null);
    setMaterializedModuleIds(new Set());
    setIsFinishing(false);
    setFinishError(null);
    setIsRemovingSource(false);
    setRemoveSourceError(null);
    setSeededSourceId(null);
    setWorkspaceContent("");
    setWorkspaceEntries([]);
    setSavedWorkspaceSourceContent("");
    setMaterialDocIdByModuleId({});
    setSavedMaterialContentByModuleId({});
    setCreatedWorkspaceModuleKeys(new Set());
    setWorkspaceModuleIdMap({});
    setMaterializedWorkspaceModuleKeys(new Set());
    setIsSavingWorkspace(false);
    setSaveWorkspaceError(null);
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

    // Running copies of the "already succeeded" trackers, updated as each
    // step succeeds -- so that if a later step fails, everything created
    // before it is still recorded (via the setState calls below) for the
    // next retry to skip, rather than only being recorded after the whole
    // operation finishes.
    const created = new Set(createdModuleIds);
    const idMap = { ...moduleIdMap };
    const materialized = new Set(materializedModuleIds);

    try {
      // Sequential, not Promise.all: Modules must be created in the current
      // temporary Module order so the resulting Book.modules order (each
      // POST atomically appends its id) matches the order shown here.
      for (const tempModule of modules) {
        if (created.has(tempModule.id)) {
          continue;
        }

        const persistedModule = await createModule(
          bookId,
          MODULE_DRAFT_DEFAULTS,
        );
        created.add(tempModule.id);
        idMap[tempModule.id] = persistedModule.id;
        setCreatedModuleIds(new Set(created));
        setModuleIdMap({ ...idMap });
      }

      // This import flow treats a Book as having one active Source --
      // Finish only runs from the upload flow, which only shows once the
      // Source-by-bookId lookup above has confirmed none exists yet, so
      // this never intentionally creates a second one. `sourceId` (rather
      // than `existingSource`) is what a retry checks, since it's updated
      // the moment this succeeds instead of only after the whole Finish
      // operation completes.
      let persistedSourceId = sourceId;

      if (!persistedSourceId) {
        const source = await createSource(
          bookId,
          buildSourceContent(editedMarkdown),
        );
        persistedSourceId = source.id;
        setSourceId(source.id);
      }

      // Same order as the Modules loop above, each attached to its
      // Module's real persisted id -- never the temporary one.
      for (const tempModule of modules) {
        if (materialized.has(tempModule.id)) {
          continue;
        }

        await createMaterial(
          bookId,
          idMap[tempModule.id],
          learningMaterials[tempModule.id] ?? "",
        );
        materialized.add(tempModule.id);
        setMaterializedModuleIds(new Set(materialized));
      }

      onModulesCreated?.();
      // Only revalidated now that every step has succeeded -- see the
      // `sourceId` comment above for why this isn't done any earlier.
      mutateSource();
      resetState();
      onClose();
    } catch (err) {
      setFinishError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      setIsFinishing(false);
    }
  }

  async function handleSaveWorkspace() {
    // Guards against a duplicate submission the same way handleFinish does.
    if (!existingSource || isSavingWorkspace) {
      return;
    }

    setIsSavingWorkspace(true);
    setSaveWorkspaceError(null);

    // Running copies of the bookkeeping state, updated as each step
    // succeeds -- see handleFinish's `created`/`idMap`/`materialized` for
    // the same pattern. `savedSourceContent` and `savedMaterialContents`
    // additionally double as the "did this actually change" check: a PATCH
    // only fires when the current draft differs from the last value
    // confirmed persisted (initially, the last-fetched value; after a
    // retry, whatever a previous attempt in this session already saved).
    let savedSourceContent = savedWorkspaceSourceContent;
    const savedMaterialContents = { ...savedMaterialContentByModuleId };
    const materialDocIds = { ...materialDocIdByModuleId };
    const createdModuleKeys = new Set(createdWorkspaceModuleKeys);
    const idMap = { ...workspaceModuleIdMap };
    const materializedModuleKeys = new Set(materializedWorkspaceModuleKeys);

    try {
      // 1. The Source itself, only if the draft actually changed.
      if (workspaceContent !== savedSourceContent) {
        await updateSource(existingSource.id, workspaceContent);
        savedSourceContent = workspaceContent;
        setSavedWorkspaceSourceContent(savedSourceContent);
      }

      // 2. Learning Material edits for Modules that already existed when
      // this workspace opened -- PATCH when a Material already exists,
      // otherwise create one, but only when the draft actually changed
      // (an untouched empty Module stays without a Material).
      for (const entry of workspaceEntries) {
        if (!entry.moduleId) {
          continue;
        }

        const original = savedMaterialContents[entry.moduleId] ?? "";

        if (entry.material === original) {
          continue;
        }

        const existingMaterialId = materialDocIds[entry.moduleId];

        if (existingMaterialId) {
          await updateMaterial(existingMaterialId, entry.material);
        } else {
          const createdMaterial = await createMaterial(
            bookId,
            entry.moduleId,
            entry.material,
          );
          materialDocIds[entry.moduleId] = createdMaterial.id;
          setMaterialDocIdByModuleId({ ...materialDocIds });
        }

        savedMaterialContents[entry.moduleId] = entry.material;
        setSavedMaterialContentByModuleId({ ...savedMaterialContents });
      }

      // 3. Every Module created from a Source Text selection in this
      // session -- sequential and in order, since each POST atomically
      // appends to `Book.modules` (same reasoning as handleFinish).
      for (const entry of workspaceEntries) {
        if (entry.moduleId || createdModuleKeys.has(entry.key)) {
          continue;
        }

        const persistedModule = await createModule(
          bookId,
          MODULE_DRAFT_DEFAULTS,
        );
        createdModuleKeys.add(entry.key);
        idMap[entry.key] = persistedModule.id;
        setCreatedWorkspaceModuleKeys(new Set(createdModuleKeys));
        setWorkspaceModuleIdMap({ ...idMap });
      }

      // 4. Each new Module's Learning Material, attached to its real
      // persisted id -- always created (even an intentionally empty one),
      // unlike step 2's existing Modules, which only write on a real
      // change.
      for (const entry of workspaceEntries) {
        if (entry.moduleId || materializedModuleKeys.has(entry.key)) {
          continue;
        }

        await createMaterial(bookId, idMap[entry.key], entry.material);
        materializedModuleKeys.add(entry.key);
        setMaterializedWorkspaceModuleKeys(new Set(materializedModuleKeys));
      }

      // Every write succeeded -- revalidate everything this screen could
      // have changed (the Edit Book page's own Modules panel included, via
      // onModulesCreated) and close, matching the saved-Source Save
      // changes success behavior.
      onModulesCreated?.();
      await mutateWorkspaceModules();
      await mutateWorkspaceMaterials();
      await mutateSource();
      setIsSavingWorkspace(false);
      resetState();
      onClose();
    } catch (err) {
      setSaveWorkspaceError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      setIsSavingWorkspace(false);
    }
  }

  async function handleRemoveSource() {
    if (!existingSource) {
      return;
    }

    setIsRemovingSource(true);
    setRemoveSourceError(null);

    try {
      await deleteSource(existingSource.id);
      await mutateSource();
      setIsRemovingSource(false);
    } catch (err) {
      setRemoveSourceError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      setIsRemovingSource(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Create from PDF"
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
      {/* Only the initial "pick" screen ever defers to the Source lookup
          (loading/error/saved-source) below -- once the user has moved past
          it into the upload workflow, `showUploadFlow` stays true for the
          rest of this modal session regardless of what that lookup's SWR
          data does in the background (a focus/reconnect-triggered
          revalidation, another tab's write, etc.). Without this, a Source
          created earlier in a Finish attempt that later fails on its
          Material step could revalidate `existingSource` to true and swap
          the in-progress Learning Material/retry screen for
          SavedSourceView, silently discarding the temporary workflow state
          Finish is required to preserve (see handleFinish, PR review). */}
      {step === "pick" && sourceLookupLoading && (
        <div className={styles.centered}>
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading source…
            </Text>
          </Group>
        </div>
      )}

      {step === "pick" && !sourceLookupLoading && sourceLookupError && (
        <div className={styles.centered}>
          <Alert color="red" title="Could not load the saved source">
            {sourceLookupError.message}
          </Alert>
        </div>
      )}

      {step === "pick" &&
        !sourceLookupLoading &&
        !sourceLookupError &&
        existingSource &&
        !(workspaceModulesData && workspaceMaterialsData) &&
        !(workspaceModulesError || workspaceMaterialsError) && (
          <div className={styles.centered}>
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading modules…
              </Text>
            </Group>
          </div>
        )}

      {step === "pick" &&
        !sourceLookupLoading &&
        !sourceLookupError &&
        existingSource &&
        // Excludes the case where Modules/Materials were already loaded
        // once and a later background revalidation failed (SWR keeps the
        // previous data on such a failure) -- that keeps showing the
        // workspace below instead of also stacking an error banner above
        // it.
        !(workspaceModulesData && workspaceMaterialsData) &&
        (workspaceModulesError || workspaceMaterialsError) && (
          <div className={styles.centered}>
            <Alert color="red" title="Could not load the Book's Modules">
              {(workspaceModulesError ?? workspaceMaterialsError)?.message}
            </Alert>
          </div>
        )}

      {step === "pick" &&
        !sourceLookupLoading &&
        !sourceLookupError &&
        existingSource &&
        workspaceModulesData &&
        workspaceMaterialsData && (
          <SavedSourceView
            content={workspaceContent}
            onContentChange={setWorkspaceContent}
            entries={workspaceEntries}
            onEntriesChange={setWorkspaceEntries}
            onRemove={handleRemoveSource}
            isRemoving={isRemovingSource}
            removeError={removeSourceError}
            onSave={handleSaveWorkspace}
            isSaving={isSavingWorkspace}
            saveError={saveWorkspaceError}
            fontScale={fontScale}
            onFontScaleChange={setFontScale}
            direction={direction}
            onDirectionChange={setDirection}
          />
        )}

      {(step !== "pick" ||
        (!sourceLookupLoading && !sourceLookupError && !existingSource)) && (
        <>
          {step === "pick" && (
            <PdfFilePicker onFileSelected={handleFileSelected} />
          )}

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
        </>
      )}
    </Modal>
  );
}
