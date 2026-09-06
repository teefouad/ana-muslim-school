"use client";

import { ItemList } from "@/components/ui/item-list";
import styles from "./sections-panel.module.css";
import type { MockSection } from "./mock-sections";

export interface SectionsPanelProps {
  /** The book's sections, in their current order. Fully controlled -- this
   * component owns no persistence, only the ItemList wiring (ANA-61). */
  sections: MockSection[];
  onSectionsChange: (sections: MockSection[]) => void;
  /** True while the owning Book has not been created/saved yet (Add Book
   * before its first save): the panel stays visible but reordering and
   * adding sections are suspended. */
  disabled?: boolean;
  className?: string;
}

// The Sections side panel shared by the Add Book and Edit Book pages
// (ANA-61). Wraps the reusable ItemList (ANA-58) around a small in-memory
// sections dataset -- reorder and Add section only update the caller's
// local state, there is no Sections API, Firestore, repository, or final
// domain model yet. Section edit/delete are intentionally not wired up: that
// needs a Section editor, which is out of scope for this card.
export function SectionsPanel({
  sections,
  onSectionsChange,
  disabled = false,
  className,
}: SectionsPanelProps) {
  function handleAdd() {
    onSectionsChange([...sections, { id: crypto.randomUUID(), title: "" }]);
  }

  return (
    <ItemList<MockSection>
      className={[className, disabled && styles.disabled]
        .filter(Boolean)
        .join(" ")}
      title="Sections"
      subtitle={`${sections.length} ${sections.length === 1 ? "section" : "sections"}`}
      items={sections}
      getItemId={(section) => section.id}
      renderItem={(section, index) => section.title || `Section ${index + 1}`}
      emptyState="This book has no sections yet."
      sortable
      onReorder={onSectionsChange}
      reorderDisabled={disabled}
      addLabel="Add section"
      onAdd={handleAdd}
      addDisabled={disabled}
    />
  );
}
