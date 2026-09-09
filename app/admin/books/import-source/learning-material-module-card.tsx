"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  Text,
  Textarea,
} from "@mantine/core";
import { GripVertical, Languages, Sparkles, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/ui/markdown-editor";
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
  /** AI Assistant (ANA-85, using ANA-74/ANA-85's server-only AI service
   * through the server-only `/api/v1/ai/assist` boundary): operates on the
   * currently *selected* Markdown within the active language's editor only
   * -- never the whole Module text (PR review). Disabled whenever that
   * editor has no non-empty selection. Clicking it captures the exact
   * selected Markdown and immediately replaces that selection in place with
   * a unique, invisible token (via `MarkdownEditorHandle.insertMarkdown`),
   * before the instructions dialog can steal focus and collapse the native
   * selection -- so the exact edited range survives regardless of what the
   * user does with focus afterward. Once Generate is clicked, `onAiAssist`
   * is called with the active language, the trimmed instructions
   * (`undefined` when blank), the captured selected Markdown, and that
   * token. The caller resolves the selection's replacement (and the Book
   * context, server-side) and is responsible for splicing the result back
   * in by replacing the *token* -- never the original selected text itself,
   * which may recur elsewhere in the document -- in that language's draft,
   * against its own *latest* state, mirroring `onTranslate` -- so a
   * concurrent edit/reorder/delete to a different Module can't be lost to a
   * stale snapshot. On Cancel, or if the request fails, the card itself
   * restores the token back to the original selected text, so the document
   * is left exactly as it was either way. The card owns the dialog, loading
   * state, and card-freeze; it never changes which language tab is active.
   * Omit to hide the affordance's inner dialog/loading wiring (the button
   * itself remains, matching `onTranslate`'s optional-but-inert pattern
   * when omitted). */
  onAiAssist?: (
    language: Language,
    instructions: string | undefined,
    selectedMarkdown: string,
    token: string,
  ) => Promise<void>;
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
// direction. AI Assistant opens its own instructions dialog and transforms
// the active editor's current selection only (ANA-85, PR review), using the
// exact same card-reads/caller-applies split Translate already established.
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
  onAiAssist,
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
  // AI Assistant (ANA-85): the instructions dialog's own open/draft state --
  // `aiInstructions` is reset to "" every time the dialog opens (never
  // carried over from a previous session), and is entirely local to this
  // card until Generate reads it once.
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // The selection AI Assistant is currently working with -- `token` is the
  // unique marker (see `handleAiAssistClick`) that's standing in for
  // `text` (the originally selected Markdown) inside `material` right now,
  // so Cancel/failure can restore it and Generate's caller knows exactly
  // what to replace. `null` whenever no AI Assistant request is pending.
  const [pendingSelection, setPendingSelection] = useState<{
    token: string;
    text: string;
  } | null>(null);
  // Whether the active language's editor currently has a non-empty
  // selection -- purely reactive UI state for the AI Assistant button's
  // `disabled` prop; the actual selected Markdown is captured fresh, on
  // demand, in `handleAiAssistClick` (see `editorRef.current
  // ?.getSelectedMarkdown()` there), not read from here.
  const [hasSelection, setHasSelection] = useState(false);
  // A language switch remounts the editor (keyed on `activeLanguage`
  // below), which naturally clears any selection -- resetting `hasSelection`
  // here, during render (matching `wasDragging` above), keeps that in sync
  // without needing an effect.
  const [hasSelectionLanguage, setHasSelectionLanguage] =
    useState(activeLanguage);
  if (hasSelectionLanguage !== activeLanguage) {
    setHasSelectionLanguage(activeLanguage);
    setHasSelection(false);
  }

  // MDXEditor's own `markdown` prop only seeds the editor's *initial*
  // content -- once mounted, an external change to `material[activeLanguage]`
  // (an AI Assistant result, or a Translate result landing on the language
  // the user has already switched to) must be pushed in via
  // `MarkdownEditorHandle.setMarkdown` instead, exactly like
  // TranslatableTextArea's own `shown` tracking. This is required for
  // Translate too, not just AI Assistant: Translate is enabled purely off
  // `material.ar`, so nothing stops the user from switching to the English
  // tab *before* clicking it, in which case its result lands on the very
  // language already on screen.
  //
  // `shown` must be React state, not a plain ref written from `onChange`
  // (PR review): the editor's own `onChange` and the parent's state update
  // both happen synchronously in the same handler, but a ref write there is
  // visible to an in-flight effect immediately, ahead of the matching
  // `material` prop update reaching this component's own render -- that gap
  // lets the effect see the ref/prop disagree for an instant and misfire
  // `setMarkdown` with stale content over the user's own keystroke.
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const activeMaterial = material[activeLanguage];
  const [shown, setShown] = useState({
    language: activeLanguage,
    value: activeMaterial,
  });

  // This is a byte-for-byte port of TranslatableTextArea's own audited
  // `shown` effect (components/ui/translatable-text-area.tsx) -- verified
  // empirically that `react-hooks/set-state-in-effect` does not flag that
  // component's identical pattern, but does flag this one, purely because
  // that component happens to be `forwardRef`-wrapped and this one isn't;
  // the rule's static analysis appears not to model a plain function
  // component's render-effect relationship the same way. Disabling here
  // rather than reshaping this component around a ref it has no other need
  // for, or reintroducing the plain-ref version PR review already rejected
  // for the race it reopens (see the comment above).
  /* eslint-disable react-hooks/set-state-in-effect -- see above */
  useEffect(() => {
    if (shown.language !== activeLanguage) {
      // A language switch already remounts the editor (keyed on
      // `activeLanguage` below) with the right initial value -- this only
      // needs to update the tracked snapshot, not call `setMarkdown`.
      setShown({ language: activeLanguage, value: activeMaterial });
      return;
    }
    if (shown.value !== activeMaterial) {
      editorRef.current?.setMarkdown(activeMaterial);
      setShown({ language: activeLanguage, value: activeMaterial });
    }
  }, [activeLanguage, activeMaterial, shown]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Subscribes to the browser's own selection-change signal to keep the AI
  // Assistant button's disabled state in sync with the active editor's
  // current selection (ANA-85, PR review) -- a genuine "subscribe to an
  // external system, setState in the callback" effect, not a synchronous
  // setState-on-every-render one, so this is unaffected by the rule
  // disabled above (mirrors module-builder-view.tsx's own identical
  // `selectionchange` subscription for its own Source Text panel).
  useEffect(() => {
    function handleSelectionChange() {
      setHasSelection(Boolean(editorRef.current?.getSelectedText().trim()));
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

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

  // Replaces `selection.token` back with `selection.text` in the active
  // language's draft -- used to undo the token substitution
  // `handleAiAssistClick` made, whenever a pending AI Assistant selection
  // never reaches a successful Generate (Cancel, or a failed request), so
  // the document is always left exactly as it was either way (PR review).
  function restoreSelection(selection: { token: string; text: string }) {
    onMaterialChange({
      ...material,
      [activeLanguage]: material[activeLanguage].replace(
        selection.token,
        selection.text,
      ),
    });
  }

  // AI Assistant (ANA-85, PR review): operates on the active editor's
  // current *selection* only. Captures the exact selected Markdown, then
  // immediately swaps it in place for a unique token via
  // `insertMarkdown` -- before the dialog can steal focus and collapse the
  // native selection -- so the exact edited range survives regardless of
  // what the user does with focus afterward, and Generate's caller can
  // later splice its result back in by replacing that token (never by
  // searching for the original text, which may recur elsewhere in the
  // document). Opens with a fresh, empty instructions field every time --
  // never the previous session's leftover draft.
  function handleAiAssistClick() {
    const selectedMarkdown = editorRef.current?.getSelectedMarkdown() ?? "";

    if (!selectedMarkdown.trim()) {
      return;
    }

    // Purely alphanumeric, deliberately -- Markdown serialization (mdast-
    // util-to-markdown) backslash-escapes underscores and hyphens even
    // mid-word (verified empirically), which would corrupt a token
    // containing either the moment it round-trips through `onChange`,
    // permanently breaking the later `.replace(token, ...)` lookup.
    const token = `AISELECTION${crypto.randomUUID().replaceAll("-", "")}`;
    editorRef.current?.insertMarkdown(token);
    setPendingSelection({ token, text: selectedMarkdown });
    setAiInstructions("");
    setAiError(null);
    setIsAiDialogOpen(true);
  }

  function handleAiDialogCancel() {
    if (pendingSelection) {
      restoreSelection(pendingSelection);
      setPendingSelection(null);
    }

    setIsAiDialogOpen(false);
  }

  async function handleGenerateClick() {
    const instructions = aiInstructions.trim() || undefined;
    const selection = pendingSelection;
    // Closes the dialog immediately on Generate, before the request
    // resolves (spec #6) -- loading then shows on the AI Assistant action
    // itself, not the (now closed) dialog.
    setIsAiDialogOpen(false);

    if (!selection) {
      return;
    }

    if (!onAiAssist) {
      // No caller wired to ever resolve the token -- restore right away
      // instead of leaving a stray marker sitting in the document.
      restoreSelection(selection);
      setPendingSelection(null);
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      await onAiAssist(
        activeLanguage,
        instructions,
        selection.text,
        selection.token,
      );
      // Leaves the active language tab exactly as the user had it (spec #6)
      // -- the card never mutates `material` itself; splicing the result
      // back in by replacing `selection.token` is entirely the caller's own
      // `onAiAssist` implementation, mirroring Translate (ANA-83). The
      // `shown`-tracking effect above pushes the resulting value into the
      // mounted editor via `setMarkdown` once the `material` prop update
      // lands.
      setPendingSelection(null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong.");
      // A failed request never leaves the token sitting in the document --
      // restore the original selected text, matching Cancel.
      restoreSelection(selection);
      setPendingSelection(null);
    } finally {
      setIsGenerating(false);
    }
  }

  const isTranslateDisabled =
    disabled || isTranslating || isGenerating || !material.ar.trim();
  // Disabled whenever the active language's editor has no non-empty
  // selection (PR review) -- AI Assistant operates on the selection only,
  // never the whole Module text.
  const isAiAssistDisabled =
    disabled || isTranslating || isGenerating || !hasSelection;
  // While *this* card's own Translate or AI Assistant request is in flight,
  // freeze the rest of the card -- the editor, language switcher, Delete,
  // AI Assistant, Translate, and drag handle -- so the exact text/language
  // either request was sent with can't change out from under it, and so it
  // can't be reordered or removed mid-request. Every other card stays fully
  // interactive; only `disabled` (Save/Finish in flight) freezes those (PR
  // review, blocking -- ANA-77; extended to `isGenerating` for ANA-85). The
  // Translate/AI Assistant actions themselves already disable via
  // `isTranslateDisabled`/`isAiAssistDisabled` above; this doesn't need to
  // include those too.
  const isCardFrozen = disabled || isTranslating || isGenerating;

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
        {/* Opens the instructions dialog for the active editor's current
            selection (ANA-85, PR review) -- disabled when there's no
            non-empty selection, since there's nothing to transform. */}
        <ActionIcon
          variant="subtle"
          className={styles.actionButton}
          aria-label="AI Assistant"
          disabled={isAiAssistDisabled}
          loading={isGenerating}
          onClick={handleAiAssistClick}
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
      {aiError && (
        <Alert color="red" mx="sm" mb="xs" py={4} role="alert">
          {aiError}
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
              ref={editorRef}
              markdown={activeMaterial}
              onChange={(value) => {
                // Batched into the same commit as the `shown` update above,
                // so the sync effect never sees them disagree for this edit
                // and bounces it back via `setMarkdown` (matching
                // TranslatableTextArea's own onChange).
                setShown({ language: activeLanguage, value });
                onMaterialChange({ ...material, [activeLanguage]: value });
              }}
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
      {isAiDialogOpen && (
        <Modal
          opened
          onClose={handleAiDialogCancel}
          title="AI Assistant"
          centered
        >
          <Text size="sm" c="dimmed" mb="md">
            The AI will transform the text you selected. The rest of the Module,
            and the other language&rsquo;s draft, stay untouched.
          </Text>
          <Textarea
            label="Additional instructions or context (optional)"
            value={aiInstructions}
            onChange={(event) => setAiInstructions(event.currentTarget.value)}
            autosize
            minRows={3}
            maxRows={8}
            mb="lg"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={handleAiDialogCancel}>
              Cancel
            </Button>
            <Button onClick={handleGenerateClick}>Generate</Button>
          </Group>
        </Modal>
      )}
    </div>
  );
}
