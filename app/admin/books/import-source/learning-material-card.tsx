"use client";

import { useState } from "react";
import { Text } from "@mantine/core";

import { MarkdownEditor } from "@/components/ui/markdown-editor";
import type { TempModule, TextDirection } from "./import-source-types";
import styles from "./learning-material-card.module.css";

export interface LearningMaterialCardProps {
  module: TempModule;
  index: number;
  /** The temporary Learning Material Markdown for this Module. Empty until
   * the user types something -- never persisted (ANA-69). */
  learningMaterial: string;
  onLearningMaterialChange: (value: string) => void;
  direction: TextDirection;
  fontScale: number;
}

// A single Module's Learning Material editing card (ANA-69): a collapsible
// section (expanded by default, mirroring ModuleCard's disclosure pattern)
// showing the Module's source text as read-only reference alongside the
// School Markdown editor for the (temporary, client-only) Learning Material.
export function LearningMaterialCard({
  module,
  index,
  learningMaterial,
  onLearningMaterialChange,
  direction,
  fontScale,
}: LearningMaterialCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={styles.card}
      data-testid={`learning-material-card-${module.id}`}
    >
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
          <div className={styles.column}>
            <Text size="sm" fw={500} className={styles.columnLabel}>
              Source text
            </Text>
            <pre
              dir={direction}
              className={styles.sourceText}
              style={{ fontSize: `${14 * (fontScale / 100)}px` }}
            >
              {module.text}
            </pre>
          </div>
          <div className={styles.column}>
            <Text size="sm" fw={500} className={styles.columnLabel}>
              Learning material
            </Text>
            <MarkdownEditor
              markdown={learningMaterial}
              onChange={onLearningMaterialChange}
              dir={direction}
            />
          </div>
        </div>
      )}
    </div>
  );
}
