"use client";

import { useRef, useState } from "react";
import { Alert, Button, Group, Text, Textarea } from "@mantine/core";
import { Plus, X } from "lucide-react";

import type {
  TextDirection,
  WorkspaceModuleEntry,
} from "./import-source-types";
import { FontSizeControl } from "./font-size-control";
import { LearningMaterialModuleCard } from "./learning-material-module-card";
import { TextDirectionControl } from "./text-direction-control";
import styles from "./saved-source-view.module.css";

export interface SavedSourceViewProps {
  /** The persisted Source's draft text (ANA-71/ANA-72) -- editable; Save
   * Changes persists it back to the Source record when it changed. */
  content: string;
  onContentChange: (value: string) => void;
  /** Every Module shown in the Modules panel, in Book order, existing
   * Modules first followed by any created from a Source Text selection in
   * this modal session (ANA-72). */
  entries: WorkspaceModuleEntry[];
  onEntriesChange: (entries: WorkspaceModuleEntry[]) => void;
  onRemove: () => void;
  /** True while the DELETE request is in flight -- disables the button and
   * shows a loading state. */
  isRemoving: boolean;
  /** Set when removal fails; the saved Source stays visible so the user can
   * retry instead of silently losing it. */
  removeError: string | null;
  onSave: () => void;
  /** True while Save Changes is in flight -- disables/freezes every
   * editable control so the UI can't diverge from the snapshot being
   * persisted (ANA-72). */
  isSaving: boolean;
  /** Set when saving fails; the modal stays open so the user can retry. */
  saveError: string | null;
  /** Same zoom/direction controls as the upload flow's OCR review step --
   * shared state owned by the modal so switching between this view and the
   * upload flow (via Select Another PDF) keeps the same reading settings. */
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
}

// Shown in place of the PDF upload flow when Import Source opens for a Book
// that already has a persisted Source (ANA-71) -- upgraded in ANA-72 to the
// same two-panel Source Text + Modules workspace as the upload flow's
// Module builder (module-builder-view.tsx), instead of a single textarea:
// the left panel is the editable Source Text (selectable, so the user can
// still create a Module from a passage), the right panel lists every
// persisted Module alongside its Learning Material, editable in place.
export function SavedSourceView({
  content,
  onContentChange,
  entries,
  onEntriesChange,
  onRemove,
  isRemoving,
  removeError,
  onSave,
  isSaving,
  saveError,
  fontScale,
  onFontScaleChange,
  direction,
  onDirectionChange,
}: SavedSourceViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  function handleSelect() {
    const el = textareaRef.current;

    if (!el || el.selectionStart === el.selectionEnd) {
      setHasSelection(false);
      return;
    }

    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
    setHasSelection(selected.trim().length > 0);
  }

  function handleBlur() {
    setHasSelection(false);
  }

  function handleCreateModule() {
    if (!hasSelection) {
      return;
    }

    const el = textareaRef.current;
    // The selection becomes the new Module's starting Learning Material
    // draft -- a convenience seed the user edits from, not a persisted
    // reference to the Source: it's stored in the same `material` field a
    // manually typed edit would be, with no separate Source->Module link
    // or field (see WorkspaceModuleEntry).
    const selectedText = el
      ? el.value.slice(el.selectionStart, el.selectionEnd)
      : "";

    onEntriesChange([
      ...entries,
      {
        key: crypto.randomUUID(),
        moduleId: null,
        // Arabic is this School's primary content language -- the selected
        // Source text seeds the Arabic draft, English starts empty (ANA-75).
        material: { ar: selectedText, en: "" },
      },
    ]);

    if (el) {
      el.setSelectionRange(el.selectionEnd, el.selectionEnd);
    }

    setHasSelection(false);
  }

  function handleMaterialChange(
    key: string,
    value: WorkspaceModuleEntry["material"],
  ) {
    onEntriesChange(
      entries.map((entry) =>
        entry.key === key ? { ...entry, material: value } : entry,
      ),
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
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
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => onContentChange(event.currentTarget.value)}
              onSelect={handleSelect}
              // `onSelect` alone doesn't reliably fire for every way a
              // selection can collapse to a plain caret (e.g. a click with
              // no drag) -- these are a redundant safety net so
              // `hasSelection` can't go stale and leave Create Module
              // enabled with nothing actually selected (Copilot review).
              onMouseUp={handleSelect}
              onKeyUp={handleSelect}
              onBlur={handleBlur}
              dir={direction}
              disabled={isSaving}
              aria-label="Source text"
              className={styles.textareaRoot}
              classNames={{ wrapper: styles.textareaWrapper }}
              styles={{
                input: {
                  flex: 1,
                  minHeight: 0,
                  height: "100%",
                  resize: "none",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: `${14 * (fontScale / 100)}px`,
                  lineHeight: 1.6,
                  padding: 16,
                  whiteSpace: "pre-wrap",
                },
              }}
            />
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Text size="sm" fw={500}>
              Modules{entries.length > 0 ? ` (${entries.length})` : ""}
            </Text>
            <Button
              size="xs"
              leftSection={<Plus size={14} aria-hidden="true" />}
              disabled={!hasSelection || isSaving}
              // Same technique as module-builder-view.tsx's Create Module --
              // preventing mousedown's default focus shift/selection
              // collapse keeps the textarea's selection intact through the
              // click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCreateModule}
            >
              Create Module
            </Button>
          </div>
          <div className={styles.panelBody}>
            {entries.length === 0 ? (
              <p className={styles.emptyState}>
                Select text on the left and click &ldquo;Create Module&rdquo; to
                get started.
              </p>
            ) : (
              <div className={styles.moduleList}>
                {entries.map((entry, index) => (
                  <LearningMaterialModuleCard
                    key={entry.key}
                    testId={`source-module-card-${index}`}
                    index={index}
                    material={entry.material}
                    onMaterialChange={(value) =>
                      handleMaterialChange(entry.key, value)
                    }
                    fontScale={fontScale}
                    disabled={isSaving}
                    // No `drag` prop -- the grip renders as the same chrome
                    // as the Create-from-PDF card, but persisted Module
                    // reordering is out of scope for this workspace
                    // (ANA-75).
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {removeError && (
        <Alert color="red" mx="md" mb="sm">
          {removeError}
        </Alert>
      )}
      {saveError && (
        <Alert color="red" mx="md" mb="sm">
          {saveError}
        </Alert>
      )}

      <div className={styles.footer}>
        <Button
          variant="default"
          color="red"
          loading={isRemoving}
          disabled={isRemoving || isSaving}
          onClick={onRemove}
          leftSection={<X size={16} aria-hidden="true" />}
        >
          Select Another PDF
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
