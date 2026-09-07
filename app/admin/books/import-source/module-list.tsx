"use client";

import { GripVertical } from "lucide-react";
import { Textarea } from "@mantine/core";

import { SortableList } from "@/components/ui/sortable-list";
import type { TempModule } from "./import-source-types";
import { ModuleCard } from "./module-card";
import styles from "./module-card.module.css";

export interface ModuleListProps {
  modules: TempModule[];
  onModulesChange: (modules: TempModule[]) => void;
}

// The floating preview shown under the pointer while dragging (ANA-64/
// ANA-68): reuses the exact same resting-card classes as ModuleCard,
// rather than a different-looking default overlay -- see
// components/ui/item-list.tsx's DefaultOverlay for the same fix applied to
// the shared ItemList. Unlike ItemList's single-line rows, a Module card's
// expanded body (its editable text) is a large, visually dominant part of
// the card -- an overlay that only showed the header would visibly "shrink"
// the dragged card down to a thin bar while its siblings stay full height,
// which reads as broken rather than as a drag preview. This mirrors the
// full expanded card (header + a static, read-only copy of its text)
// instead, matching what the card actually looks like at rest.
function ModuleCardOverlay({
  module,
  index,
}: {
  module: TempModule;
  index: number;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.grip} aria-hidden="true">
          <GripVertical size={16} />
        </span>
        <span className={styles.title}>Module {index + 1}</span>
      </div>
      <div className={styles.body}>
        <Textarea
          value={module.text}
          readOnly
          autosize
          minRows={3}
          aria-hidden="true"
          tabIndex={-1}
          styles={{ input: { fontFamily: "var(--font-mono, monospace)" } }}
        />
      </div>
    </div>
  );
}

export function ModuleList({ modules, onModulesChange }: ModuleListProps) {
  return (
    <SortableList<TempModule>
      className={styles.list}
      items={modules}
      getId={(module) => module.id}
      onReorder={onModulesChange}
      renderItem={(module, index) => (
        <ModuleCard
          key={module.id}
          module={module}
          index={index}
          onTextChange={(text) =>
            onModulesChange(
              modules.map((candidate) =>
                candidate.id === module.id ? { ...candidate, text } : candidate,
              ),
            )
          }
        />
      )}
      renderOverlay={(module, index) => (
        <ModuleCardOverlay module={module} index={index} />
      )}
    />
  );
}
