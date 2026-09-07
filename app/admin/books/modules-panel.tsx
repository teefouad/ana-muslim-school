"use client";

import { ItemList } from "@/components/ui/item-list";
import styles from "./modules-panel.module.css";
import type { MockModule } from "./mock-modules";

export interface ModulesPanelProps {
  /** The book's modules, in their current order. Fully controlled -- this
   * component owns no persistence, only the ItemList wiring (ANA-61). */
  modules: MockModule[];
  onModulesChange: (modules: MockModule[]) => void;
  /** True while the owning Book has not been created/saved yet (Add Book
   * before its first save): the panel stays visible but reordering and
   * adding modules are suspended. */
  disabled?: boolean;
  className?: string;
}

function getModuleLabel(module: MockModule, index: number): string {
  return module.title || `Module ${index + 1}`;
}

// The Modules side panel shared by the Add Book and Edit Book pages
// (ANA-61, renamed from Sections in ANA-68 to match the canonical School
// domain model). Wraps the reusable ItemList (ANA-58) around a
// caller-provided `modules` list -- reorder, add, and delete only update
// the caller's own state; this component owns no persistence itself.
// Add Book still passes local, pre-save `MockModule[]` state. Edit Book (as
// of ANA-70) instead maps its real, API-backed Modules into this same
// `MockModule` shape for display and creates Modules through the Import
// Source flow's Finish action -- reorder/add/delete from this panel aren't
// persisted for it yet, so its `onModulesChange` is a no-op until a
// follow-up card wires those to `/api/v1/books/{bookId}/modules` (see
// lib/modules/types.ts).
export function ModulesPanel({
  modules,
  onModulesChange,
  disabled = false,
  className,
}: ModulesPanelProps) {
  function handleAdd() {
    onModulesChange([...modules, { id: crypto.randomUUID(), title: "" }]);
  }

  function handleDelete(module: MockModule) {
    onModulesChange(modules.filter((candidate) => candidate.id !== module.id));
  }

  return (
    <ItemList<MockModule>
      className={[className, disabled && styles.disabled]
        .filter(Boolean)
        .join(" ")}
      title="Modules"
      subtitle={`${modules.length} ${modules.length === 1 ? "module" : "modules"}`}
      items={modules}
      getItemId={(module) => module.id}
      renderItem={(module, index) => getModuleLabel(module, index)}
      emptyState="This book has no modules yet."
      sortable
      onReorder={onModulesChange}
      reorderDisabled={disabled}
      // A real Module editor is out of scope here (ANA-65/ANA-68) -- the
      // pencil action is exposed per the agreed ItemList affordance API, and
      // the Module-persistence card gives it real behavior.
      onEditItem={() => {}}
      getEditLabel={(module, index) => `Edit ${getModuleLabel(module, index)}`}
      editDisabled={disabled}
      onDeleteItem={handleDelete}
      getDeleteLabel={(module, index) =>
        `Delete ${getModuleLabel(module, index)}`
      }
      deleteDisabled={disabled}
      addLabel="Add module"
      onAdd={handleAdd}
      addDisabled={disabled}
    />
  );
}
