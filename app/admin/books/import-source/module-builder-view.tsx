"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Text } from "@mantine/core";
import { ArrowLeft, Plus } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { SortableList } from "@/components/ui/sortable-list";
import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule, TextDirection } from "./import-source-types";
import { DocumentSummary } from "./document-summary";
import { FontSizeControl } from "./font-size-control";
import { LearningMaterialModuleCard } from "./learning-material-module-card";
import { TextDirectionControl } from "./text-direction-control";
import styles from "./module-builder-view.module.css";

export interface ModuleBuilderViewProps {
  fileName: string;
  ocrResult: OcrResult;
  editedMarkdown: Record<number, string>;
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
  modules: TempModule[];
  onModulesChange: (modules: TempModule[]) => void;
  onBack: () => void;
  /** True once at least one temporary Module has already been persisted in
   * the current Finish session (a partial failure) -- disables Back so the
   * reviewed OCR result (and, transitively, this Module list) can't be
   * discarded out from under Modules that already exist under the Book and
   * can't be rolled back from here. Also freezes reordering, since a
   * partial Finish retry replays `modules` in its *current* order (ANA-75;
   * mirrors the old LearningMaterialView's `backDisabled`). */
  backDisabled: boolean;
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

const EMPTY_MATERIAL: TranslatableString = { ar: "", en: "" };

function SortableModuleCard({
  module,
  index,
  onMaterialChange,
  fontScale,
  disabled,
  reorderDisabled,
}: {
  module: TempModule;
  index: number;
  onMaterialChange: (value: TranslatableString) => void;
  fontScale: number;
  disabled: boolean;
  reorderDisabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id, disabled: reorderDisabled });

  return (
    <LearningMaterialModuleCard
      testId={`module-card-${module.id}`}
      index={index}
      material={module.material}
      onMaterialChange={onMaterialChange}
      fontScale={fontScale}
      disabled={disabled}
      drag={
        reorderDisabled
          ? undefined
          : {
              attributes,
              listeners,
              setNodeRef,
              style: {
                transform: CSS.Transform.toString(transform),
                transition,
              },
              isDragging,
            }
      }
    />
  );
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

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Text size="sm" fw={500}>
              Modules{modules.length > 0 ? ` (${modules.length})` : ""}
            </Text>
            <Button
              size="xs"
              leftSection={<Plus size={14} aria-hidden="true" />}
              // Also locked while Finish is in flight (PR review, ANA-75):
              // Finish operates on the `modules` snapshot it was invoked
              // with, so a Module created mid-request would show a draft
              // that was never actually part of that Finish attempt and
              // then vanishes once it succeeds and resets the modal.
              disabled={!canCreateModule || isFinishing}
              // Clicking a button starts with a mousedown, whose default
              // browser behavior both collapses the current text selection
              // and shifts focus away from the source `<pre>` -- either one
              // alone clears `selectedText` before this button's own
              // onClick can run. Preventing that default keeps the
              // selection (and focus) intact through the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCreateModule}
            >
              Create Module
            </Button>
          </div>
          <div className={styles.panelBody}>
            {modules.length === 0 ? (
              <p className={styles.emptyState}>
                Select text on the left and click &ldquo;Create Module&rdquo; to
                get started.
              </p>
            ) : (
              <SortableList<TempModule>
                items={modules}
                getId={(module) => module.id}
                onReorder={onModulesChange}
                renderItem={(module, index) => (
                  <SortableModuleCard
                    key={module.id}
                    module={module}
                    index={index}
                    onMaterialChange={(value) =>
                      handleModuleMaterialChange(module.id, value)
                    }
                    fontScale={fontScale}
                    disabled={isFinishing}
                    reorderDisabled={reorderDisabled}
                  />
                )}
                renderOverlay={(module, index) => (
                  <LearningMaterialModuleCard
                    testId={`module-card-overlay-${module.id}`}
                    index={index}
                    material={module.material ?? EMPTY_MATERIAL}
                    onMaterialChange={() => {}}
                    fontScale={fontScale}
                    disabled
                  />
                )}
              />
            )}
          </div>
        </div>
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
