"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Alert, Button, Group, Text, Textarea } from "@mantine/core";
import { X } from "lucide-react";

import type {
  TextDirection,
  WorkspaceModuleEntry,
} from "./import-source-types";
import { assistLearningMaterial } from "./ai-assist-client";
import { deleteModule } from "./modules-client";
import { translateArabicToEnglish } from "./translate-client";
import { FontSizeControl } from "./font-size-control";
import { SourceModulesPanel } from "./source-modules-panel";
import { TextDirectionControl } from "./text-direction-control";
import styles from "./saved-source-view.module.css";

const TEMPORARY_DELETE_CONFIRM_DESCRIPTION =
  "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.";

export interface SavedSourceViewProps {
  /** The Book this workspace belongs to -- needed to call the Module
   * DELETE API for a persisted entry (ANA-77). */
  bookId: string;
  /** The persisted Source's draft text (ANA-71/ANA-72) -- editable; Save
   * Changes persists it back to the Source record when it changed. */
  content: string;
  onContentChange: (value: string) => void;
  /** Every Module shown in the Modules panel, in Book order, existing
   * Modules first followed by any created from a Source Text selection in
   * this modal session (ANA-72). */
  entries: WorkspaceModuleEntry[];
  /** Accepts a plain array like a normal controlled-value setter, or a
   * functional updater `(current) => next` -- the real caller (the Import
   * Source modal) passes its own `useState` setter directly, so this
   * component can rely on the functional form to apply a result (e.g. a
   * finished Translate request, see `handleTranslateEntry`) against
   * whatever `entries` looks like *at that moment*, not a stale value
   * captured before an earlier `await` (PR review, blocking -- ANA-77). */
  onEntriesChange: Dispatch<SetStateAction<WorkspaceModuleEntry[]>>;
  /** Called once a persisted Module's delete request succeeds, so the
   * caller can revalidate its own Modules/Materials SWR caches (ANA-77) --
   * never called for a local-only (unsaved, `moduleId === null`) delete,
   * since nothing was persisted to revalidate. */
  onModuleDeleted?: () => void | Promise<void>;
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
  bookId,
  content,
  onContentChange,
  entries,
  onEntriesChange,
  onModuleDeleted,
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
  // Set to the entry currently being deleted through the Module DELETE API
  // -- disables every card's delete action while it's in flight, mirroring
  // `isSaving` (ANA-77). A local-only (unsaved) delete never sets this: it
  // has nothing to await.
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Deletes a single Module card (ANA-77) -- called only after the card's
  // own confirmation dialog has already been accepted. `entry.moduleId` is
  // read at call time, so a temporary entry already promoted to a real
  // Module mid partial-Save (see import-source-modal.tsx's
  // handleSaveWorkspace) is correctly treated as persisted here, never
  // locally orphaned. Removes the entry through a functional update
  // against the *current* `entries` when the request settles, same
  // reasoning as `handleTranslateEntry` -- the workspace stays editable
  // while a persisted delete is in flight, so any other card's concurrent
  // edit must survive it resolving late, not get reverted by a stale
  // array.
  async function handleDeleteEntry(key: string) {
    setDeleteError(null);

    const entry = entries.find((candidate) => candidate.key === key);

    if (!entry) {
      return;
    }

    if (!entry.moduleId) {
      onEntriesChange((current) =>
        current.filter((candidate) => candidate.key !== key),
      );
      return;
    }

    setDeletingKey(key);

    try {
      await deleteModule(bookId, entry.moduleId);
      onEntriesChange((current) =>
        current.filter((candidate) => candidate.key !== key),
      );
      await onModuleDeleted?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setDeletingKey(null);
    }
  }

  // Translates a single card's Arabic draft to English (ANA-77) -- reads
  // the *current* `entry.material.ar` at call time, so an edit made after
  // the request started never gets clobbered: only `material.en` is
  // replaced. Applies the result through a functional update against
  // whichever `entries` is current *when the request resolves*, not the
  // `entries` snapshot captured here before the `await` -- the workspace
  // stays fully editable while translation is in flight, so a concurrent
  // edit/reorder/delete to a *different* card (or even a further edit to
  // this same card's Arabic draft) must survive this resolving late,
  // instead of being silently reverted by a stale array (PR review,
  // blocking).
  async function handleTranslateEntry(key: string) {
    const entry = entries.find((candidate) => candidate.key === key);

    if (!entry) {
      return;
    }

    const translated = await translateArabicToEnglish(entry.material.ar);

    onEntriesChange((current) =>
      current.map((candidate) =>
        candidate.key === key
          ? {
              ...candidate,
              material: { ...candidate.material, en: translated },
            }
          : candidate,
      ),
    );
  }

  // AI Assistant for a single card's current selection (ANA-85, PR review)
  // -- sends only `selectedMarkdown` (the exact text the card captured, not
  // the whole entry) to the AI and returns the replacement text. Unlike
  // Translate/the earlier token-based design, this never touches `entries`
  // itself: the calling card applies the result in place by restoring its
  // own captured Lexical selection and replacing exactly that range, which
  // fires the card's normal `onChange` -> `onMaterialChange` -- so
  // `entries` is never in an intermediate state a concurrent Save changes
  // could persist, and there is nothing here to key by `key`.
  // `language` is accepted for signature compatibility with
  // `SourceModulesPanel`'s `onAiAssistItem` (which still reports which
  // editor tab was active), but is never forwarded to the AI Assistant
  // request itself -- AI Assistance is Arabic-only end to end (ANA-99), and
  // the `/api/v1/ai/assist` request contract no longer accepts a language.
  async function handleAiAssistEntry(
    _key: string,
    _language: "ar" | "en",
    instructions: string | undefined,
    selectedMarkdown: string,
  ): Promise<string> {
    return assistLearningMaterial({
      bookId,
      text: selectedMarkdown,
      additionalInstructions: instructions,
    });
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

        <SourceModulesPanel<WorkspaceModuleEntry>
          items={entries}
          getKey={(entry) => entry.key}
          getMaterial={(entry) => entry.material}
          onMaterialChange={handleMaterialChange}
          onReorder={onEntriesChange}
          fontScale={fontScale}
          disabled={isSaving}
          // Reordering is a draft change, persisted to `Book.modules` by
          // Save changes once every temporary id has resolved (ANA-79) --
          // suspended while that request is in flight so the displayed
          // order can't shift out from under it.
          reorderDisabled={isSaving}
          canCreateModule={hasSelection}
          onCreateModule={handleCreateModule}
          onDeleteItem={handleDeleteEntry}
          getDeleteConfirmDescription={(key) => {
            const entry = entries.find((candidate) => candidate.key === key);
            return entry?.moduleId
              ? undefined
              : TEMPORARY_DELETE_CONFIRM_DESCRIPTION;
          }}
          isDeleteDisabled={() => isSaving || deletingKey !== null}
          onTranslateItem={handleTranslateEntry}
          onAiAssistItem={handleAiAssistEntry}
        />
      </div>

      {removeError && (
        <Alert color="red" mx="md" mb="sm">
          {removeError}
        </Alert>
      )}
      {deleteError && (
        <Alert color="red" mx="md" mb="sm">
          {deleteError}
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
