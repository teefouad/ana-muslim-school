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
import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type {
  TempModule,
  TextDirection,
  WorkspaceModuleEntry,
} from "./import-source-types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buildSourceContent } from "./build-source-content";
import { createMaterial, updateMaterial } from "./materials-client";
import { ModuleBuilderView } from "./module-builder-view";
import { createModule } from "./modules-client";
import { OcrResultView } from "./ocr-result-view";
import { PdfFilePicker } from "./pdf-file-picker";
import { PdfViewer } from "./pdf-viewer";
import { SavedSourceView } from "./saved-source-view";
import { createSource, deleteSource, updateSource } from "./sources-client";
import { useOcrRun } from "./use-ocr-run";
import styles from "./import-source-modal.module.css";

const EMPTY_MATERIAL: TranslatableString = { ar: "", en: "" };

/** Whether two Learning Material drafts are the same in both languages --
 * used both for the retry-safety "did this actually change" checks (ANA-72)
 * and for the dirty-state comparisons this card adds (ANA-75), so a switch
 * between them can share the exact same notion of equality. */
function materialsEqual(a: TranslatableString, b: TranslatableString): boolean {
  return a.ar === b.ar && a.en === b.en;
}

/** What the modal is currently asking the user to confirm before it
 * proceeds -- see the `pendingConfirmation` state and `confirmDialogProps`
 * below (ANA-75). Each destructive/discarding transition renders through
 * the same `ConfirmDialog`, driven by whichever `kind` is pending. */
type PendingConfirmation =
  | { kind: "discard-close" }
  | { kind: "remove-source" }
  | { kind: "back-to-page-selection" };

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

type Step = "pick" | "select-pages" | "review-ocr" | "build-modules";

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

// The full PDF -> page selection -> Mistral OCR review -> Module-building
// (now also the Learning Material editing + Finish step, ANA-75) ->
// persistence workflow (ANA-68/ANA-69/ANA-70/ANA-71). Owns every piece of
// workflow state itself -- opening the modal never
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
  // Retry-safety bookkeeping for each temporary Module's Material, mirroring
  // the saved-Source workspace's own `materialDocIdByModuleId`/
  // `savedMaterialContentByModuleId` (see handleSaveWorkspace) -- keyed by
  // the *temporary* Module id here, since every entry in `modules` is new
  // to this Finish session (there's no pre-existing-vs-new distinction like
  // the workspace's `entry.moduleId` gives it). A one-shot "already
  // materialized" flag (the previous design) would permanently skip a
  // Module on every later retry, silently dropping an edit made to its
  // Learning Material *after* its Material already succeeded but a
  // *different* write in the same attempt failed (PR review, blocking) --
  // tracking the persisted Material id plus its last-saved content instead
  // lets a retry PATCH a real change instead of skipping it outright.
  const [materialDocIdByTempModuleId, setMaterialDocIdByTempModuleId] =
    useState<Record<string, string>>({});
  const [
    materializedMaterialContentByTempModuleId,
    setMaterializedMaterialContentByTempModuleId,
  ] = useState<Record<string, TranslatableString>>({});
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
  // createdModuleIds/moduleIdMap/materialDocIdByTempModuleId above -- each
  // is updated the moment its own write succeeds so a retry after a
  // partial failure only re-sends what didn't yet land.
  const [savedWorkspaceSourceContent, setSavedWorkspaceSourceContent] =
    useState("");
  const [materialDocIdByModuleId, setMaterialDocIdByModuleId] = useState<
    Record<string, string>
  >({});
  const [savedMaterialContentByModuleId, setSavedMaterialContentByModuleId] =
    useState<Record<string, TranslatableString>>({});
  const [createdWorkspaceModuleKeys, setCreatedWorkspaceModuleKeys] = useState<
    Set<string>
  >(new Set());
  const [workspaceModuleIdMap, setWorkspaceModuleIdMap] = useState<
    Record<string, string>
  >({});
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [saveWorkspaceError, setSaveWorkspaceError] = useState<string | null>(
    null,
  );
  // Drives the modal's confirmation dialogs (ANA-75) -- see
  // `PendingConfirmation` and `confirmDialogProps` below.
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
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

  // Drives the modal's title (ANA-75): "Source Text" only while the saved-
  // Source workspace itself is showing, "Create from PDF" for every other
  // state of the "pick" step (loading/error included, matching this flow's
  // existing default) and for every step of the PDF upload/OCR/Module-
  // building workflow. Recomputed from `existingSource`/`step` on every
  // render rather than tracked separately, so removing the saved Source
  // (Select Another PDF) or finishing the upload flow always keeps the
  // title in sync with what's actually on screen.
  const showingSavedSource =
    step === "pick" &&
    !sourceLookupLoading &&
    !sourceLookupError &&
    Boolean(existingSource);

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
  // Unwraps to a plain `Module[]`, matching EditBookPage's own fetcher for
  // this exact key -- SWR shares one cache entry per key regardless of
  // which hook's fetcher runs, so a mismatched shape here (e.g. reading
  // `{ data: Module[] }` while the other hook caches the unwrapped array)
  // crashes whichever hook reads a value written by the other's fetcher
  // (PR review, ANA-72).
  const {
    data: workspaceModules,
    error: workspaceModulesError,
    mutate: mutateWorkspaceModules,
  } = useSWR(modulesUrl, (url) =>
    fetchJson<{ data: Module[] }>(url).then((response) => response.data),
  );

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
    workspaceModules &&
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
    const initialMaterialContents: Record<string, TranslatableString> = {};

    for (const material of workspaceMaterialsData.data) {
      initialMaterialDocIds[material.moduleId] = material.id;
      initialMaterialContents[material.moduleId] = material.content;
    }

    setSeededSourceId(existingSource.id);
    setWorkspaceContent(existingSource.content);
    setWorkspaceEntries(
      workspaceModules.map((module) => ({
        key: module.id,
        moduleId: module.id,
        material: materialByModuleId.get(module.id)?.content ?? EMPTY_MATERIAL,
      })),
    );
    setSavedWorkspaceSourceContent(existingSource.content);
    setMaterialDocIdByModuleId(initialMaterialDocIds);
    setSavedMaterialContentByModuleId(initialMaterialContents);
    setCreatedWorkspaceModuleKeys(new Set());
    setWorkspaceModuleIdMap({});
    setSaveWorkspaceError(null);
  }

  // Whether the saved-Source workspace has anything Save Changes hasn't
  // persisted yet (ANA-75): the Source Text draft, any Module's Learning
  // Material draft (either language), or a new temporary Module created in
  // this session (`moduleId === null`, always dirty until Save Changes
  // creates it). Reuses the exact same "did this actually change" baselines
  // Save Changes itself already tracks for retry-safety
  // (`savedWorkspaceSourceContent`/`savedMaterialContentByModuleId`), so
  // there's only one notion of "changed" for this workspace, not two.
  const isWorkspaceDirty =
    workspaceContent !== savedWorkspaceSourceContent ||
    workspaceEntries.some(
      (entry) =>
        !entry.moduleId ||
        !materialsEqual(
          entry.material,
          savedMaterialContentByModuleId[entry.moduleId] ?? EMPTY_MATERIAL,
        ),
    );

  // Whether the Create-from-PDF workflow has any meaningful, unsaved work
  // (ANA-75): every step past the initial "pick" picker implies at least a
  // PDF was selected -- and every other trigger this modal cares about
  // (reviewed/edited OCR text, created Module drafts, edited Learning
  // Material) only becomes reachable after that same step change, so this
  // one check already covers all of them. Only meaningful while the upload
  // flow itself is showing (`!existingSource`) -- see `isDirty` below.
  const isCreateFromPdfDirty = step !== "pick";

  // What the close guard (X button/Escape/backdrop -- all funnel through
  // Modal's own `onClose`, see `handleClose`) actually checks. Whichever of
  // the two flows is currently on screen decides which dirty check applies;
  // they're never both relevant at once (see `showingSavedSource`).
  const isDirty = showingSavedSource ? isWorkspaceDirty : isCreateFromPdfDirty;

  function resetState() {
    setStep("pick");
    setFile(null);
    setSelectedPages(new Set());
    setOcrResult(null);
    setEditedMarkdown({});
    setFontScale(100);
    setDirection("rtl");
    setModules([]);
    setCreatedModuleIds(new Set());
    setModuleIdMap({});
    setSourceId(null);
    setMaterialDocIdByTempModuleId({});
    setMaterializedMaterialContentByTempModuleId({});
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
    setIsSavingWorkspace(false);
    setSaveWorkspaceError(null);
    setPendingConfirmation(null);
    ocrRun.invalidate();
  }

  // Funnels every way of closing the modal (X button, Escape, backdrop
  // click -- Mantine's Modal fires the same `onClose` for all three) through
  // one dirty check (ANA-75). A save/finish already in flight is never
  // raced: closing is simply ignored until it settles (success already
  // closes the modal itself; failure leaves the user free to retry or close
  // once it's no longer in flight).
  function handleClose() {
    if (isFinishing || isSavingWorkspace) {
      return;
    }

    if (isDirty) {
      setPendingConfirmation({ kind: "discard-close" });
      return;
    }

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
      setStep("review-ocr");
    });
  }

  // Only ever reachable from the "review-ocr" step, which always has a
  // reviewed OCR result to lose -- so this always confirms first (ANA-75);
  // see `performBackToPageSelection` for the actual transition, run once
  // the user confirms.
  function handleBackToPageSelection() {
    setPendingConfirmation({ kind: "back-to-page-selection" });
  }

  function performBackToPageSelection() {
    // Mirrors handleRunOcr's own reset when a fresh OCR result replaces an
    // earlier one -- discards the reviewed OCR result and everything built
    // from it, while explicitly preserving the selected PDF/page-selection
    // choices (ANA-75).
    ocrRun.invalidate();
    setOcrResult(null);
    setEditedMarkdown({});
    setModules([]);
    setStep("select-pages");
  }

  function handleCreateModules() {
    setStep("build-modules");
  }

  function handleBackToReview() {
    setStep("review-ocr");
  }

  async function handleFinish() {
    // Guards against a duplicate submission from repeated clicks while a
    // Finish operation is already running, in addition to the button's own
    // disabled-while-loading state (belt and suspenders against a fast
    // double-click landing before the re-render). Enabled even with zero
    // temporary Modules (ANA-75) -- reaching this screen already represents
    // a valid reviewed Source import (e.g. attaching/replacing a Book's
    // Source without adding any new Module), so the Module/Material loops
    // below simply no-op over an empty `modules` array and only the Source
    // gets created.
    if (isFinishing) {
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
    const materialDocIds = { ...materialDocIdByTempModuleId };
    const materializedContents = {
      ...materializedMaterialContentByTempModuleId,
    };

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
      // Module's real persisted id -- never the temporary one. PATCH when
      // this Module's Material already exists (from an earlier attempt in
      // this Finish session) and its draft actually changed since then,
      // otherwise create it -- the same diff-based pattern
      // handleSaveWorkspace uses, so an edit made to an already-succeeded
      // Module's Learning Material after a *different* Module's Material
      // fails is PATCHed on retry instead of silently skipped (PR review,
      // blocking).
      for (const tempModule of modules) {
        const existingMaterialId = materialDocIds[tempModule.id];

        if (existingMaterialId) {
          const original =
            materializedContents[tempModule.id] ?? EMPTY_MATERIAL;

          if (materialsEqual(tempModule.material, original)) {
            continue;
          }

          await updateMaterial(existingMaterialId, tempModule.material);
        } else {
          const createdMaterial = await createMaterial(
            bookId,
            idMap[tempModule.id],
            tempModule.material,
          );
          materialDocIds[tempModule.id] = createdMaterial.id;
          setMaterialDocIdByTempModuleId({ ...materialDocIds });
        }

        materializedContents[tempModule.id] = tempModule.material;
        setMaterializedMaterialContentByTempModuleId({
          ...materializedContents,
        });
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
    // succeeds -- see handleFinish's `created`/`idMap` for the same
    // pattern. `savedSourceContent` and `savedMaterialContents`
    // additionally double as the "did this actually change" check: a PATCH
    // only fires when the current draft differs from the last value
    // confirmed persisted (initially, the last-fetched value; after a
    // retry, whatever a previous attempt in this session already saved).
    let savedSourceContent = savedWorkspaceSourceContent;
    const savedMaterialContents = { ...savedMaterialContentByModuleId };
    const materialDocIds = { ...materialDocIdByModuleId };
    const createdModuleKeys = new Set(createdWorkspaceModuleKeys);
    const idMap = { ...workspaceModuleIdMap };

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
      // (an untouched empty Module stays without a Material). Explicitly
      // excludes any entry created in *this* Save session (`createdModuleKeys`)
      // even though its `moduleId` is already promoted by the time this
      // runs on a retry (see step 3) -- that one always goes through step
      // 4 below instead, which always writes its Material once (even an
      // empty one) rather than diffing against a baseline.
      for (const entry of workspaceEntries) {
        if (!entry.moduleId || createdModuleKeys.has(entry.key)) {
          continue;
        }

        const original =
          savedMaterialContents[entry.moduleId] ?? EMPTY_MATERIAL;

        if (materialsEqual(entry.material, original)) {
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
      // `entry.moduleId` is promoted to the real persisted id the instant
      // its own Module POST succeeds, *before* step 4 attempts that
      // Module's Material -- so a Delete click racing a later failure in
      // step 4 (e.g. this entry's own Material POST throws, or a
      // different entry's does) always sees a real `moduleId` and goes
      // through the Module DELETE API instead of removing the entry
      // locally and orphaning the Module that already exists under the
      // Book (PR review, blocking).
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
        setWorkspaceEntries((current) =>
          current.map((candidate) =>
            candidate.key === entry.key
              ? { ...candidate, moduleId: persistedModule.id }
              : candidate,
          ),
        );
      }

      // 4. Each new Module's Learning Material, attached to its real
      // persisted id -- always created (even an intentionally empty one),
      // unlike step 2's existing Modules, which only write on a real
      // change. Selected via `createdModuleKeys` (this session's own
      // "newly created" set) rather than `entry.moduleId` presence, since
      // step 3 above already promoted that for every entry in this loop.
      // Guarded by `materialDocIds` (the same map step 2 uses) rather than
      // a separate one-shot "already materialized" flag: a flag would
      // permanently skip this entry on every future Save Changes, silently
      // dropping an edit made after this Material succeeds but a
      // *different* write in the same attempt fails (PR review, blocking).
      // Once its Material is created, the entry looks exactly like an
      // originally-persisted Module (recorded in
      // `materialDocIds`/`savedMaterialContents`, `createdModuleKeys` still
      // holds its key) so step 2 explicitly keeps skipping it and this step
      // never touches it again.
      for (const entry of workspaceEntries) {
        if (!createdModuleKeys.has(entry.key)) {
          continue;
        }

        const realModuleId = idMap[entry.key];

        if (materialDocIds[realModuleId] !== undefined) {
          continue;
        }

        const createdMaterial = await createMaterial(
          bookId,
          realModuleId,
          entry.material,
        );
        materialDocIds[realModuleId] = createdMaterial.id;
        savedMaterialContents[realModuleId] = entry.material;
        setMaterialDocIdByModuleId({ ...materialDocIds });
        setSavedMaterialContentByModuleId({ ...savedMaterialContents });
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

  // "Select Another PDF" opens the confirmation dialog first (ANA-75) --
  // the actual DELETE only runs once the user confirms, via
  // `handleRemoveSource` below.
  function handleRemoveSourceRequest() {
    setPendingConfirmation({ kind: "remove-source" });
  }

  async function handleRemoveSource() {
    if (!existingSource || isRemovingSource) {
      return;
    }

    setIsRemovingSource(true);
    setRemoveSourceError(null);

    try {
      await deleteSource(existingSource.id);
      await mutateSource();
      setIsRemovingSource(false);
      // Closes the confirmation and reveals the (now PDF-upload) flow
      // behind it -- a failure instead falls through to the catch below,
      // which also closes the dialog so the existing saved-workspace error
      // Alert (already wired to `removeSourceError`) stays the visible
      // failure surface, matching the pre-ANA-75 behavior.
      setPendingConfirmation(null);
    } catch (err) {
      setRemoveSourceError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      setIsRemovingSource(false);
      setPendingConfirmation(null);
    }
  }

  // What `pendingConfirmation` renders as, with the exact copy the spec
  // requires (ANA-75) -- `null` when nothing is pending, so the caller
  // below can render this unconditionally.
  const activeConfirmDialog = !pendingConfirmation
    ? null
    : pendingConfirmation.kind === "discard-close"
      ? {
          title: "Discard unsaved changes?",
          description: "Your changes have not been saved and will be lost.",
          confirmLabel: "Discard changes",
          cancelLabel: "Keep editing",
          isConfirming: false,
          onCancel: () => setPendingConfirmation(null),
          onConfirm: () => {
            resetState();
            onClose();
          },
        }
      : pendingConfirmation.kind === "remove-source"
        ? {
            title: "Remove attached source?",
            description:
              "This removes the Source Text attached to this book and returns to PDF upload. Existing Modules and Learning Materials will not be deleted. Any unsaved changes in this modal will also be lost.",
            confirmLabel: "Remove source",
            cancelLabel: "Keep source",
            isConfirming: isRemovingSource,
            onCancel: () => setPendingConfirmation(null),
            onConfirm: handleRemoveSource,
          }
        : {
            title: "Return to page selection?",
            description:
              "Changes made to the current extracted Source Text will be discarded.",
            confirmLabel: "Return to page selection",
            cancelLabel: "Keep editing",
            isConfirming: false,
            onCancel: () => setPendingConfirmation(null),
            onConfirm: () => {
              setPendingConfirmation(null);
              performBackToPageSelection();
            },
          };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title={showingSavedSource ? "Source Text" : "Create from PDF"}
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
          the in-progress Module builder/retry screen for SavedSourceView,
          silently discarding the temporary workflow state Finish is
          required to preserve (see handleFinish, PR review). */}
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
          !(workspaceModules && workspaceMaterialsData) &&
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
          !(workspaceModules && workspaceMaterialsData) &&
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
          workspaceModules &&
          workspaceMaterialsData && (
            <SavedSourceView
              bookId={bookId}
              content={workspaceContent}
              onContentChange={setWorkspaceContent}
              entries={workspaceEntries}
              onEntriesChange={setWorkspaceEntries}
              onModuleDeleted={async () => {
                await mutateWorkspaceModules();
                await mutateWorkspaceMaterials();
              }}
              onRemove={handleRemoveSourceRequest}
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
                backDisabled={createdModuleIds.size > 0}
                createdModuleIds={createdModuleIds}
                onFinish={handleFinish}
                isFinishing={isFinishing}
                finishError={finishError}
              />
            )}
          </>
        )}
      </Modal>
      {activeConfirmDialog && <ConfirmDialog opened {...activeConfirmDialog} />}
    </>
  );
}
