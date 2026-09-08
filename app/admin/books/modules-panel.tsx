"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  /** When provided, Delete shows a confirmation dialog and calls this to
   * persist the deletion of a real, API-backed Module (Edit Book, ANA-77)
   * instead of the panel's default instant local removal through
   * `onModulesChange` (Add Book's pre-save Modules, which omit this and
   * keep that original behavior unchanged). Rejecting leaves the Module in
   * place and surfaces the error. */
  onDeleteModule?: (module: MockModule) => Promise<void>;
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
// Source flow's Finish action -- reorder/add from this panel still aren't
// persisted for it (`onModulesChange` stays a no-op until a follow-up card
// wires those to `/api/v1/books/{bookId}/modules`, see
// lib/modules/types.ts), but Delete is real (ANA-77): passing
// `onDeleteModule` persists it through the Module DELETE API instead of the
// panel's default local-only removal.
export function ModulesPanel({
  modules,
  onModulesChange,
  disabled = false,
  className,
  onDeleteModule,
}: ModulesPanelProps) {
  // The real Module currently pending a confirmed delete -- only ever set
  // when `onDeleteModule` is provided (Edit Book's persisted Modules,
  // ANA-77). Add Book's own local/pre-save Modules never go through this;
  // see `handleDeleteRequest` below.
  const [pendingDelete, setPendingDelete] = useState<MockModule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleAdd() {
    onModulesChange([...modules, { id: crypto.randomUUID(), title: "" }]);
  }

  function handleDeleteRequest(module: MockModule) {
    if (onDeleteModule) {
      setDeleteError(null);
      setPendingDelete(module);
      return;
    }

    // Add Book's pre-save Modules aren't persisted anywhere yet, so there's
    // nothing to confirm or call an API for -- unchanged from before ANA-77.
    onModulesChange(modules.filter((candidate) => candidate.id !== module.id));
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || !onDeleteModule) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteModule(pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelDelete() {
    setPendingDelete(null);
    setDeleteError(null);
  }

  return (
    <>
      <ItemList<MockModule>
        className={[className, styles.root, disabled && styles.disabled]
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
        getEditLabel={(module, index) =>
          `Edit ${getModuleLabel(module, index)}`
        }
        editDisabled={disabled}
        onDeleteItem={handleDeleteRequest}
        getDeleteLabel={(module, index) =>
          `Delete ${getModuleLabel(module, index)}`
        }
        deleteDisabled={disabled}
        deletingItemId={pendingDelete && isDeleting ? pendingDelete.id : null}
        error={deleteError}
        addLabel="Add module"
        onAdd={handleAdd}
        addDisabled={disabled}
      />
      {pendingDelete && (
        <ConfirmDialog
          opened
          title="Delete module?"
          description="This permanently deletes this Module and its Learning Material. This action cannot be undone."
          confirmLabel="Delete module"
          cancelLabel="Cancel"
          isConfirming={isDeleting}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
