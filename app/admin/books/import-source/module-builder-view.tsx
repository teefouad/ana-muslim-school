"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Alert, Button, Group, Text } from "@mantine/core";
import { ArrowLeft } from "lucide-react";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule, TextDirection } from "./import-source-types";
import { DocumentSummary } from "./document-summary";
import { FontSizeControl } from "./font-size-control";
import { SourceModulesPanel } from "./source-modules-panel";
import { TextDirectionControl } from "./text-direction-control";
import { translateArabicToEnglish } from "./translate-client";
import styles from "./module-builder-view.module.css";

const TEMPORARY_DELETE_CONFIRM_DESCRIPTION =
  "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.";

export interface ModuleBuilderViewProps {
  fileName: string;
  ocrResult: OcrResult;
  editedMarkdown: Record<number, string>;
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
  modules: TempModule[];
  /** Accepts a plain array like a normal controlled-value setter, or a
   * functional updater `(current) => next` -- the real caller (the Import
   * Source modal) passes its own `useState` setter directly, so this
   * component can rely on the functional form to apply a result (e.g. a
   * finished Translate request, see `handleTranslateModule`) against
   * whatever `modules` looks like *at that moment*, not a stale value
   * captured before an earlier `await` (PR review, blocking -- ANA-77). */
  onModulesChange: Dispatch<SetStateAction<TempModule[]>>;
  onBack: () => void;
  /** True once at least one temporary Module has already been persisted in
   * the current Finish session (a partial failure) -- disables Back so the
   * reviewed OCR result (and, transitively, this Module list) can't be
   * discarded out from under Modules that already exist under the Book and
   * can't be rolled back from here. Also freezes reordering, since a
   * partial Finish retry replays `modules` in its *current* order (ANA-75;
   * mirrors the old LearningMaterialView's `backDisabled`). */
  backDisabled: boolean;
  /** Temporary Module ids already persisted through a partial Finish
   * attempt in this modal session (ANA-77) -- disables that specific
   * card's Delete action so a local-only delete can never orphan a Module
   * that already exists under the Book (mirrors `backDisabled`'s own
   * reasoning; see import-source-modal.tsx's `createdModuleIds`). */
  createdModuleIds: Set<string>;
  /** Creates every temporary Module (and its Material) for the current Book
   * through the existing Module/Material APIs, in order, then persists the
   * reviewed Source -- this is the flow's only remaining editing screen, so
   * Finish runs directly from here (ANA-75; no separate Learning Material
   * step). Enabled even with zero temporary Modules: reaching this screen
   * already represents a valid reviewed Source import (e.g. attaching a new
   * Source to a Book that already has Modules). */
  onFinish: () => void;
  /** True while a Finish operation is in flight -- disables every editable
   * control (shows a loading state on Finish) and guards against duplicate
   * submission from repeated clicks. */
  isFinishing: boolean;
  /** Set when Finish fails; cleared on the next attempt. The modal stays
   * open so the user can retry without losing progress. */
  finishError: string | null;
}

// Step 4, and now the *final* editing step, of the Import Source modal
// (ANA-68, simplified by ANA-75): the Module-building screen. The left
// panel is the selectable, reviewed Source Text; the right panel lists
// every temporary Module as the same shared `LearningMaterialModuleCard`
// used by the saved-Source workspace -- selecting text and clicking
// "Create Module" seeds a Module's Arabic Learning Material directly (English
// starts empty), and the user edits both languages right here. Finish
// replaces the old "Create Learning Material" step entirely.
export function ModuleBuilderView({
  fileName,
  ocrResult,
  editedMarkdown,
  fontScale,
  onFontScaleChange,
  direction,
  onDirectionChange,
  modules,
  onModulesChange,
  onBack,
  backDisabled,
  createdModuleIds,
  onFinish,
  isFinishing,
  finishError,
}: ModuleBuilderViewProps) {
  const sourceRef = useRef<HTMLPreElement>(null);
  const [selectedText, setSelectedText] = useState("");

  const joinedText = ocrResult.pages
    .map((page) => editedMarkdown[page.pageNumber] ?? page.markdown)
    .join("\n\n");

  useEffect(() => {
    function handleSelectionChange() {
      const source = sourceRef.current;
      const selection = document.getSelection();

      if (
        !source ||
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !source.contains(selection.getRangeAt(0).commonAncestorContainer)
      ) {
        setSelectedText("");
        return;
      }

      setSelectedText(selection.toString());
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  function handleSourceBlur(event: React.FocusEvent<HTMLPreElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setSelectedText("");
    }
  }

  const canCreateModule = selectedText.trim().length > 0;

  function handleCreateModule() {
    if (!canCreateModule) {
      return;
    }

    onModulesChange([
      ...modules,
      {
        id: crypto.randomUUID(),
        // Arabic is this School's primary content language -- the selected
        // Source text seeds the Arabic draft, English starts empty
        // (ANA-75).
        material: { ar: selectedText, en: "" },
      },
    ]);
    document.getSelection()?.removeAllRanges();
    setSelectedText("");
  }

  function handleModuleMaterialChange(
    moduleId: string,
    material: TranslatableString,
  ) {
    onModulesChange(
      modules.map((module) =>
        module.id === moduleId ? { ...module, material } : module,
      ),
    );
  }

  // These temporary Modules never exist server-side before Finish runs, so
  // deleting one is always a plain local removal -- no API call, and no
  // partial-Finish bookkeeping to update (ANA-77). The orphan guard for a
  // Module already persisted mid partial-Finish is `createdModuleIds`
  // disabling that card's Delete action in the first place (see
  // `deleteDisabled` below), not anything checked here.
  function handleDeleteModule(moduleId: string) {
    onModulesChange(modules.filter((module) => module.id !== moduleId));
  }

  // Translates a single card's Arabic draft to English (ANA-77) -- reads
  // the *current* Module's `material.ar` at call time, so an edit made
  // after the request started never gets clobbered: only `material.en` is
  // replaced. Applies the result through a functional update against
  // whichever `modules` is current *when the request resolves*, not the
  // `modules` snapshot captured here before the `await` -- the builder
  // stays fully editable (add/delete/reorder/edit) while translation is in
  // flight, so a concurrent change to a *different* temporary Module must
  // survive this resolving late, instead of being silently reverted by a
  // stale array (PR review, blocking).
  async function handleTranslateModule(moduleId: string) {
    const targetModule = modules.find((module) => module.id === moduleId);

    if (!targetModule) {
      return;
    }

    const translated = await translateArabicToEnglish(targetModule.material.ar);

    onModulesChange((current) =>
      current.map((module) =>
        module.id === moduleId
          ? { ...module, material: { ...module.material, en: translated } }
          : module,
      ),
    );
  }

  const reorderDisabled = isFinishing || backDisabled;

  return (
    <div className={styles.shell}>
      <div className={styles.summaryHeader}>
        <DocumentSummary fileName={fileName} ocrResult={ocrResult} />
        <Group gap="sm">
          <FontSizeControl value={fontScale} onChange={onFontScaleChange} />
          <TextDirectionControl
            value={direction}
            onChange={onDirectionChange}
          />
        </Group>
      </div>

      <div className={styles.body}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Text size="sm" fw={500}>
              Source Text
            </Text>
          </div>
          <div className={styles.panelBody}>
            <pre
              ref={sourceRef}
              tabIndex={0}
              dir={direction}
              className={styles.sourceText}
              style={{ fontSize: `${14 * (fontScale / 100)}px` }}
              onBlur={handleSourceBlur}
            >
              {joinedText || (
                <span className={styles.placeholder}>
                  No text was extracted from this document.
                </span>
              )}
            </pre>
          </div>
        </div>

        <SourceModulesPanel<TempModule>
          items={modules}
          getKey={(module) => module.id}
          getMaterial={(module) => module.material}
          onMaterialChange={handleModuleMaterialChange}
          onReorder={onModulesChange}
          fontScale={fontScale}
          disabled={isFinishing}
          reorderDisabled={reorderDisabled}
          canCreateModule={canCreateModule}
          onCreateModule={handleCreateModule}
          onDeleteItem={handleDeleteModule}
          getDeleteConfirmDescription={() =>
            TEMPORARY_DELETE_CONFIRM_DESCRIPTION
          }
          isDeleteDisabled={(id) => isFinishing || createdModuleIds.has(id)}
          onTranslateItem={handleTranslateModule}
        />
      </div>

      {finishError && (
        <Alert color="red" mx="md" mb="sm">
          {finishError}
        </Alert>
      )}

      {backDisabled && (
        <Text size="xs" c="dimmed" mx="md" mb="sm">
          Some Modules have already been created for this Book -- Back is
          unavailable until Finish completes. Retry Finish below.
        </Text>
      )}

      <div className={styles.footer}>
        <Button
          variant="default"
          leftSection={<ArrowLeft size={16} aria-hidden="true" />}
          onClick={onBack}
          // Also locked while Finish is in flight (PR review, ANA-75): Back
          // would otherwise move the workflow to OCR review while a request
          // Finish already started is still running.
          disabled={isFinishing || backDisabled}
        >
          Back
        </Button>
        <Button loading={isFinishing} onClick={onFinish}>
          Finish
        </Button>
      </div>
    </div>
  );
}
