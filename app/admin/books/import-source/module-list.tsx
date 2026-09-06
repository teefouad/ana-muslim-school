"use client";

import { GripVertical } from "lucide-react";

import { SortableList } from "@/components/ui/sortable-list";
import type { TempModule } from "./import-source-types";
import { ModuleCard } from "./module-card";
import styles from "./module-card.module.css";

export interface ModuleListProps {
  modules: TempModule[];
  onModulesChange: (modules: TempModule[]) => void;
}

// The floating preview shown under the pointer while dragging (ANA-64/
// ANA-68): reuses the exact same resting-card classes as ModuleCard's
// header, rather than a different-looking default overlay -- see
// components/ui/item-list.tsx's DefaultOverlay for the same fix applied to
// the shared ItemList.
function ModuleCardOverlay({ index }: { index: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.grip} aria-hidden="true">
          <GripVertical size={16} />
        </span>
        <span className={styles.title}>Module {index + 1}</span>
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
      renderOverlay={(_module, index) => <ModuleCardOverlay index={index} />}
    />
  );
}
