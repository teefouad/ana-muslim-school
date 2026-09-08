"use client";

import { useState, type CSSProperties } from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { ActionIcon, Alert } from "@mantine/core";
import { GripVertical, Languages, Sparkles, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import type { LanguageOption } from "@/components/ui/translatable-value";
import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import styles from "./learning-material-module-card.module.css";

const LANGUAGES: readonly LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

type Language = "ar" | "en";

const DEFAULT_DELETE_CONFIRM_DESCRIPTION =
  "This permanently deletes this Module and its Learning Material. This action cannot be undone.";

export interface LearningMaterialModuleCardProps {
  /** Stable id for this card's DOM node -- distinct from any Module id
   * since a not-yet-persisted temporary Module has no real id yet. */
  testId: string;
  index: number;
  /** The Module's Learning Material draft, both languages at once (ANA-75)
   * -- switching the header's language switcher never discards either
   * value, unlike the single-string editor this replaced. */
  material: TranslatableString;
  onMaterialChange: (value: TranslatableString) => void;
  fontScale: number;
  /** True while a Save/Finish request is persisting the snapshot this card
   * was showing when it was submitted -- makes the editor and every header
   * action read-only so further edits can't diverge from what's actually
   * being persisted. */
  disabled?: boolean;
  /** Present only when this card renders inside a draggable list (the
   * Create-from-PDF temporary Module list) -- wires the grip icon as
   * dnd-kit's real drag handle and applies the list's drag transform to
   * this card's own root. Omitted in the saved-Source workspace, where the
   * grip renders as the same chrome but purely decorative: persisted
   * Module reordering is out of scope for that flow (ANA-75). */
  drag?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    isDragging: boolean;
  };
  /** Called once the user confirms deletion in this card's own confirmation
   * dialog (ANA-77) -- the card only owns the confirm/cancel UX; whether
   * that means a local-only removal or a real Module DELETE request (and
   * any resulting error) is entirely up to the caller. May be async -- the
   * confirm dialog shows a loading state until it resolves. Omit to hide
   * the delete affordance entirely. */
  onDelete?: () => Promise<void> | void;
  /** The delete confirmation dialog's description -- callers pass
   * persisted vs. temporary/unsaved copy since the card itself doesn't know
   * which kind of Module it represents. Defaults to the persisted-Module
   * copy. */
  deleteConfirmDescription?: string;
  /** Disables the delete affordance for a reason beyond `disabled` -- e.g. a
   * temporary Module already persisted during a partial Save/Finish retry,
   * which must never be locally orphaned by a local-only delete. */
  deleteDisabled?: boolean;
  /** Arabic -> English translation of this Module's Learning Material
   * (ANA-77, using ANA-74's AI service through the server-only
   * `/api/v1/ai/translate` boundary): reads the current `material.ar`
   * draft, replaces `material.en` via `onMaterialChange`, and rejects on
   * failure without touching either draft. The card owns the loading state
   * and switches the active language to English once this resolves. Omit
   * to hide the translate affordance entirely. */
  onTranslate?: () => Promise<void>;
}

type PendingAction = "delete" | "translate" | null;

// The single Module-card shell shared by the Create-from-PDF Learning
// Material step and the saved-Source ("View source text") workspace
// (ANA-75) -- previously two independently-styled components
// (LearningMaterialCard/SourceModuleCard) that had drifted apart. Header,
// left to right: drag handle, "Module N" title, then -- immediately left of
// the language switcher -- Delete/AI Assistant/Translate, hidden at rest
// and revealed together on header hover/focus-within (ANA-77); the language
// switcher itself stays visible and is always the right-most control. Body:
// the School MarkdownEditor for whichever language is currently active,
// direction following that language rather than a global source-text
// direction. AI Assistant remains UI-only here -- wiring the actual dialog
// is a later card.
export function LearningMaterialModuleCard({
  testId,
  index,
  material,
  onMaterialChange,
  fontScale,
  disabled = false,
  drag,
  onDelete,
  deleteConfirmDescription = DEFAULT_DELETE_CONFIRM_DESCRIPTION,
  deleteDisabled = false,
  onTranslate,
}: LearningMaterialModuleCardProps) {
  const [expanded, setExpanded] = useState(true);
  // Every card defaults to Arabic (ANA-75) -- this School's primary content
  // language, matching TranslatableTextArea's own default-language rule.
  const [activeLanguage, setActiveLanguage] = useState<Language>("ar");
  const dir = activeLanguage === "ar" ? "rtl" : "ltr";
  // Which of this card's own confirmation dialogs (if any) is open -- both
  // Delete and "Replace English translation?" reuse the same ConfirmDialog
  // primitive rather than inventing a second confirmation UX (ANA-77).
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

  function handleDeleteClick() {
    setPendingAction("delete");
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    await onDelete?.();
    setIsDeleting(false);
    setPendingAction(null);
  }

  async function runTranslate() {
    if (!onTranslate) {
      return;
    }

    setIsTranslating(true);
    setTranslateError(null);

    try {
      await onTranslate();
      // Switches the card over so the user immediately sees the result
      // (ANA-77) -- only on success; a failure leaves the active language
      // (and both drafts) untouched.
      setActiveLanguage("en");
    } catch (err) {
      setTranslateError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsTranslating(false);
    }
  }

  function handleTranslateClick() {
    // Replacing non-empty English content is destructive, so it gets its
    // own confirmation; an empty English draft translates immediately
    // (ANA-77).
    if (material.en.trim()) {
      setPendingAction("translate");
      return;
    }

    void runTranslate();
  }

  function handleConfirmTranslate() {
    setPendingAction(null);
    void runTranslate();
  }

  function handleCancelPendingAction() {
    setPendingAction(null);
  }

  const isTranslateDisabled = disabled || isTranslating || !material.ar.trim();

  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      data-testid={testId}
      className={[styles.card, drag?.isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
    >
      {/* A plain container, not itself an interactive role -- it holds the
          drag handle, the collapse toggle, and the delete/AI/translate/
          language actions as separate sibling controls (matching
          item-list.tsx's RowChrome) rather than nesting all of them inside
          one shared "button", which is invalid ARIA once a header hosts
          more than a single click target (ANA-75). */}
      <div className={styles.header}>
        <span
          className={[styles.grip, drag && styles.gripDraggable]
            .filter(Boolean)
            .join(" ")}
          {...(drag
            ? { ...drag.attributes, ...drag.listeners }
            : { "aria-hidden": true })}
        >
          <GripVertical size={16} />
        </span>
        <button
          type="button"
          className={styles.titleButton}
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          Module {index + 1}
        </button>
        <div className={styles.spacer} />
        {/* Delete, AI Assistant, and Translate: hidden at rest, revealed
            together on header hover/focus-within (ANA-77) -- always
            immediately to the left of the language switcher, which is
            never part of this hover-hidden group. */}
        <ActionIcon
          variant="subtle"
          color="red"
          className={styles.actionButton}
          aria-label={`Delete Module ${index + 1}`}
          disabled={disabled || deleteDisabled}
          onClick={handleDeleteClick}
        >
          <Trash2 size={14} aria-hidden="true" />
        </ActionIcon>
        {/* UI-only affordance (ANA-75): no AI instructions dialog opens and
            no request is made from this card yet -- wiring the actual AI
            service (see ANA-74) to this button is a later card. */}
        <ActionIcon
          variant="subtle"
          className={styles.actionButton}
          aria-label="AI Assistant"
          disabled={disabled}
        >
          <Sparkles size={16} aria-hidden="true" />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          className={styles.actionButton}
          aria-label="Translate to English"
          disabled={isTranslateDisabled}
          loading={isTranslating}
          onClick={handleTranslateClick}
        >
          <Languages size={16} aria-hidden="true" />
        </ActionIcon>
        <LanguageSwitcher
          languages={LANGUAGES}
          value={activeLanguage}
          onChange={(slug) => setActiveLanguage(slug as Language)}
          isFilled={(slug) => Boolean(material[slug as Language]?.trim())}
          disabled={disabled}
        />
      </div>
      {translateError && (
        <Alert color="red" mx="sm" mb="xs" py={4} role="alert">
          {translateError}
        </Alert>
      )}
      {expanded && (
        <div className={styles.body}>
          <div
            data-testid={`${testId}-editor-scale`}
            className={styles.editorFill}
            style={{ fontSize: `${14 * (fontScale / 100)}px` }}
          >
            <MarkdownEditor
              key={activeLanguage}
              markdown={material[activeLanguage]}
              onChange={(value) =>
                onMaterialChange({ ...material, [activeLanguage]: value })
              }
              dir={dir}
              fillHeight
              disabled={disabled}
            />
          </div>
        </div>
      )}
      {pendingAction === "delete" && (
        <ConfirmDialog
          opened
          title="Delete module?"
          description={deleteConfirmDescription}
          confirmLabel="Delete module"
          cancelLabel="Cancel"
          isConfirming={isDeleting}
          onCancel={handleCancelPendingAction}
          onConfirm={handleConfirmDelete}
        />
      )}
      {pendingAction === "translate" && (
        <ConfirmDialog
          opened
          title="Replace English translation?"
          description="Translating again will replace the current English Learning Material."
          confirmLabel="Translate and replace"
          cancelLabel="Cancel"
          onCancel={handleCancelPendingAction}
          onConfirm={handleConfirmTranslate}
        />
      )}
    </div>
  );
}
