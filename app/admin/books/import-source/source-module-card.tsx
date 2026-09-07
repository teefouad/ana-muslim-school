"use client";

import { useState } from "react";

import { MarkdownEditor } from "@/components/ui/markdown-editor";
import type { TextDirection } from "./import-source-types";
import styles from "./source-module-card.module.css";

export interface SourceModuleCardProps {
  index: number;
  /** The Module's Learning Material Markdown -- empty when the Module has
   * no Material yet, or seeded from a Source Text selection for a Module
   * just created in this session (ANA-72, PR review). Either way it's
   * just this Module's Material draft, editable like any other -- there
   * is no persisted Source->Module relationship or separate source-text
   * field to show alongside it. */
  material: string;
  onMaterialChange: (value: string) => void;
  direction: TextDirection;
  fontScale: number;
  /** True while Save Changes is persisting the snapshot this card was
   * showing when it was clicked -- makes the editor read-only so further
   * edits can't diverge from what's actually being persisted. */
  disabled?: boolean;
}

// A single Module's Learning Material editing card in the saved-Source
// workspace (ANA-72): a collapsible section (expanded by default, mirroring
// ModuleCard/LearningMaterialCard's disclosure pattern) showing the School
// MarkdownEditor for that Module's Learning Material -- no source-text
// column, since a persisted Module has no source passage to reconstruct.
export function SourceModuleCard({
  index,
  material,
  onMaterialChange,
  direction,
  fontScale,
  disabled = false,
}: SourceModuleCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.card} data-testid={`source-module-card-${index}`}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className={styles.title}>Module {index + 1}</span>
      </button>
      {expanded && (
        <div className={styles.body}>
          {/* MarkdownEditor has no fontSize prop of its own (see
              components/README.md's "no business logic" rule) -- a plain
              wrapping font-size cascades to it via CSS inheritance instead,
              same technique as learning-material-card.tsx. */}
          <div
            data-testid="source-module-editor-scale"
            className={styles.editorFill}
            style={{ fontSize: `${14 * (fontScale / 100)}px` }}
          >
            <MarkdownEditor
              markdown={material}
              onChange={onMaterialChange}
              dir={direction}
              fillHeight
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}
