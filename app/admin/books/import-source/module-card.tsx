"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Textarea } from "@mantine/core";
import { GripVertical } from "lucide-react";

import type { TempModule } from "./import-source-types";
import styles from "./module-card.module.css";

export interface ModuleCardProps {
  module: TempModule;
  index: number;
  onTextChange: (text: string) => void;
}

// A single temporary, unsaved Module (ANA-68) -- vertically sortable and
// collapsible. Unlike components/ui/item-list.tsx's rows (where only a
// dedicated grip icon is draggable), the whole header is both the drag
// handle and the expand/collapse control here per spec: dnd-kit's pointer
// sensor only starts a drag once the pointer has moved past its activation
// distance (see components/ui/sortable-list.tsx), so a plain click still
// reaches the header's own onClick and toggles collapse.
export function ModuleCard({ module, index, onTextChange }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(true);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

  function handleHeaderKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Preserve dnd-kit's own keyboard-sortable handling (Space to lift/drop,
    // arrow keys to move) before layering the expand/collapse toggle on
    // Enter on top of it.
    listeners?.onKeyDown?.(event);

    if (event.key === "Enter") {
      toggleExpanded();
    }
  }

  function stopPropagation(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <li
      ref={setNodeRef}
      data-testid={`module-card-${module.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[styles.card, isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        {...attributes}
        {...listeners}
        className={styles.header}
        aria-expanded={expanded}
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
      >
        <span className={styles.grip} aria-hidden="true">
          <GripVertical size={16} />
        </span>
        <span className={styles.title}>Module {index + 1}</span>
      </div>
      {expanded && (
        <div className={styles.body}>
          <Textarea
            value={module.text}
            onChange={(event) => onTextChange(event.currentTarget.value)}
            aria-label={`Module ${index + 1} text`}
            autosize
            minRows={3}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
            styles={{ input: { fontFamily: "var(--font-mono, monospace)" } }}
          />
        </div>
      )}
    </li>
  );
}
