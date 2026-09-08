"use client";

import { useState, type CSSProperties } from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { ActionIcon } from "@mantine/core";
import { GripVertical, Sparkles, Trash2 } from "lucide-react";

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
}

// The single Module-card shell shared by the Create-from-PDF Learning
// Material step and the saved-Source ("View source text") workspace
// (ANA-75) -- previously two independently-styled components
// (LearningMaterialCard/SourceModuleCard) that had drifted apart. Header:
// drag handle + "Module N" + delete affordance on the left, language
// switcher + AI Assistant on the right. Body: the School MarkdownEditor for
// whichever language is currently active, direction following that
// language rather than a global source-text direction. The delete and AI
// Assistant actions are UI-only here -- see their own doc comments below.
export function LearningMaterialModuleCard({
  testId,
  index,
  material,
  onMaterialChange,
  fontScale,
  disabled = false,
  drag,
}: LearningMaterialModuleCardProps) {
  const [expanded, setExpanded] = useState(true);
  // Every card defaults to Arabic (ANA-75) -- this School's primary content
  // language, matching TranslatableTextArea's own default-language rule.
  const [activeLanguage, setActiveLanguage] = useState<Language>("ar");
  const dir = activeLanguage === "ar" ? "rtl" : "ltr";

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

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
          drag handle, the collapse toggle, and the delete/language/AI
          actions as separate sibling controls (matching item-list.tsx's
          RowChrome) rather than nesting all of them inside one shared
          "button", which is invalid ARIA once a header hosts more than a
          single click target (ANA-75). */}
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
        {/* Deletion is intentionally not wired here (ANA-75) -- this is the
            final visual/hover affordance (same treatment as the Book
            Modules list's own delete action), but persisted Module
            deletion from this card is a separate, later card. */}
        <ActionIcon
          variant="subtle"
          color="red"
          className={styles.deleteAction}
          aria-label={`Delete Module ${index + 1}`}
          disabled={disabled}
        >
          <Trash2 size={14} aria-hidden="true" />
        </ActionIcon>
        <div className={styles.spacer} />
        <LanguageSwitcher
          languages={LANGUAGES}
          value={activeLanguage}
          onChange={(slug) => setActiveLanguage(slug as Language)}
          isFilled={(slug) => Boolean(material[slug as Language]?.trim())}
          disabled={disabled}
        />
        {/* UI-only affordance (ANA-75): no AI instructions dialog opens and
            no request is made from this card yet -- wiring the actual AI
            service (see ANA-74) to this button is a later card. */}
        <ActionIcon
          variant="subtle"
          className={styles.aiButton}
          aria-label="AI Assistant"
          disabled={disabled}
        >
          <Sparkles size={16} aria-hidden="true" />
        </ActionIcon>
      </div>
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
    </div>
  );
}
