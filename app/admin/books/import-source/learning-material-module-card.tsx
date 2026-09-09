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
   * and never changes which language tab is active (ANA-83) -- success or
   * failure. Omit to hide the translate affordance entirely. */
  onTranslate?: () => Promise<void>;
  /** Renders this card as a non-interactive drag preview (ANA-80): always
   * collapsed regardless of internal state, and the collapse toggle never
   * responds to clicks. Used for `SortableList`'s `DragOverlay` copy, which
   * mounts a fresh instance of this component on every drag -- without
   * this, that fresh instance would default to its own `expanded: true`
   * and show the Markdown editor mid-drag even when the real card being
   * dragged was collapsed. */
  forceCollapsed?: boolean;
  /** Explicit inline style for the card's root element, merged under
   * `drag.style` -- used by the drag overlay to pin its width to the
   * dragged card's own measured size (ANA-80), since a portaled preview
   * has no natural container width of its own to inherit. */
  style?: CSSProperties;
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
  forceCollapsed = false,
  style,
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

  // Collapses the card the instant a drag starts (ANA-80) -- an expanded
  // card must never keep showing its Markdown editor while being dragged,
  // and once collapsed this way it must stay collapsed after drop/cancel
  // until the user explicitly re-expands it. Adjusting state directly
  // during render on a prop change (rather than in a `useEffect`) is the
  // pattern React itself recommends for this
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-change)
  // -- it also sidesteps this repo's `react-hooks/set-state-in-effect`
  // lint rule, which flags any state update reachable from a `useEffect`.
  const isDragging = Boolean(drag?.isDragging);
  const [wasDragging, setWasDragging] = useState(isDragging);
  if (isDragging !== wasDragging) {
    setWasDragging(isDragging);
    if (isDragging && expanded) {
      setExpanded(false);
    }
  }

  // Forced collapsed for the drag overlay's own fresh instance, which has
  // no `drag` prop (and so never observes `isDragging` above) but must
  // still never show the editor (ANA-80).
  const effectiveExpanded = forceCollapsed ? false : expanded;

  function toggleExpanded() {
    if (forceCollapsed) return;
    setExpanded((prev) => !prev);
  }

  function handleDeleteClick() {
    setPendingAction("delete");
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);

    try {
      await onDelete?.();
    } catch {
      // The owning view is responsible for surfacing a delete failure
      // itself (e.g. an Alert next to the list) -- this dialog only needs
      // to stop blocking, not duplicate that error. Swallowing here also
      // keeps a rejecting `onDelete` from becoming an unhandled promise
      // rejection, since `ConfirmDialog` fires `onConfirm` without
      // awaiting it (PR review).
    } finally {
      // Always runs, even if `onDelete` throws -- otherwise a rejection
      // would leave `isDeleting` stuck true, permanently blocking
      // Cancel/Escape via `ConfirmDialog`'s `isConfirming` prop (PR
      // review, Copilot).
      setIsDeleting(false);
      setPendingAction(null);
    }
  }

  async function runTranslate() {
    if (!onTranslate) {
      return;
    }

    setIsTranslating(true);
    setTranslateError(null);

    try {
      await onTranslate();
      // Leaves the active language tab exactly as the user had it (ANA-83)
      // -- success or failure, only `material.en` changes here.
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
  // While *this* card's own Translate request is in flight, freeze the
  // rest of the card -- the editor, language switcher, Delete, AI
  // Assistant, and drag handle -- so the Arabic source it was sent with
  // can't change out from under the request and so it can't be reordered
  // or removed mid-translate. Every other card stays fully interactive;
  // only `disabled` (Save/Finish in flight) freezes those (PR review,
  // blocking -- ANA-77). The Translate action itself already disables via
  // `isTranslateDisabled` above; this doesn't need to include it too.
  const isCardFrozen = disabled || isTranslating;

  return (
    <div
      ref={drag?.setNodeRef}
      style={{ ...style, ...drag?.style }}
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
          className={[
            styles.grip,
            drag && !isCardFrozen && styles.gripDraggable,
          ]
            .filter(Boolean)
            .join(" ")}
          {...(drag && !isCardFrozen
            ? { ...drag.attributes, ...drag.listeners }
            : { "aria-hidden": true })}
        >
          <GripVertical size={16} />
        </span>
        <button
          type="button"
          className={styles.titleButton}
          aria-expanded={effectiveExpanded}
          disabled={forceCollapsed}
          onClick={toggleExpanded}
        >
          Module {index + 1}
        </button>
        {/* Delete, AI Assistant, and Translate: hidden at rest, revealed
            together on header hover/focus-within (ANA-77) -- always
            immediately to the left of the language switcher, which is
            never part of this hover-hidden group. Delete/Translate only
            render when the caller actually wired them -- an omitted
            handler hides the affordance entirely rather than rendering a
            button that silently does nothing when clicked (PR review,
            Copilot). */}
        {onDelete && (
          <ActionIcon
            variant="subtle"
            color="red"
            className={styles.actionButton}
            aria-label={`Delete Module ${index + 1}`}
            disabled={isCardFrozen || deleteDisabled}
            onClick={handleDeleteClick}
          >
            <Trash2 size={14} aria-hidden="true" />
          </ActionIcon>
        )}
        {/* UI-only affordance (ANA-75): no AI instructions dialog opens and
            no request is made from this card yet -- wiring the actual AI
            service (see ANA-74) to this button is a later card. */}
        <ActionIcon
          variant="subtle"
          className={styles.actionButton}
          aria-label="AI Assistant"
          disabled={isCardFrozen}
        >
          <Sparkles size={16} aria-hidden="true" />
        </ActionIcon>
        {onTranslate && (
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
        )}
        <LanguageSwitcher
          languages={LANGUAGES}
          value={activeLanguage}
          onChange={(slug) => setActiveLanguage(slug as Language)}
          isFilled={(slug) => Boolean(material[slug as Language]?.trim())}
          disabled={isCardFrozen}
        />
      </div>
      {translateError && (
        <Alert color="red" mx="sm" mb="xs" py={4} role="alert">
          {translateError}
        </Alert>
      )}
      {effectiveExpanded && (
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
              disabled={isCardFrozen}
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
