"use client";

import { useRef } from "react";
import { Drawer } from "@mantine/core";

import type { Book } from "@/lib/books/types";
import { ModuleEditorBody } from "./module-editor-body";
import type { ModuleFieldsValues } from "./module-fields";

/** `null` closes the drawer; otherwise the existing Module being edited --
 * its `id` and current field values, read fresh by the caller the same way
 * `EditModuleModal`'s own `"edit"` state is (see `[id]/edit/page.tsx`'s
 * `getModuleFields`). Unlike `EditModuleModalState`, there's no `"create"`
 * variant here (ANA-121): Add Module stays on the existing modal -- this
 * drawer is scoped to editing an existing Module only, so its own public
 * state type never needs to carry a create-mode branch its container would
 * otherwise have to plumb through unused. */
export type EditModuleDrawerState = {
  id: string;
  fields: ModuleFieldsValues;
} | null;

export interface EditModuleDrawerProps {
  state: EditModuleDrawerState;
  /** The owning Book -- forwarded to `ModuleEditorBody` unchanged; see
   * `EditModuleModalProps.book`'s identical doc. */
  book: Book;
  onClose: () => void;
  /** Called with the drawer's current field values when Save changes is
   * clicked -- same awaited resolve/reject contract as `EditModuleModal`'s
   * own `onSave`. */
  onSave: (
    id: string,
    fields: ModuleFieldsValues,
    lessonsOrder: string[] | null,
  ) => Promise<void>;
}

// Fixed 500px on desktop (ANA-121); `min(...)` caps it at the viewport width
// on anything narrower instead of overflowing horizontally, the same
// "shrink to fit, never overflow" contract `EditModuleModal`'s own edit-mode
// width already uses for its 1040px cap.
const DRAWER_WIDTH = "min(500px, 100vw)";

// Right-side drawer (ANA-121) opened from the Edit Book screen's Modules
// panel for the pencil action -- replaces the Edit Module modal for editing
// an existing Module only; Add Module is unaffected and still opens that
// modal in create mode. Renders the exact same Module-editing experience as
// the modal's own edit mode through the shared `ModuleEditorBody`
// (`module-editor-body.tsx`) -- same fields, AI actions, validation, Lesson
// list/editor, loading states, save behavior, discard protection, and
// backend integration -- just inside a different container, with `layout=
// "narrow"` so `ModuleEditorBody`'s Module-editor+Lessons-list split stacks
// in one column instead of trying to fit side by side in 500px. The modal
// component itself (`edit-module-modal.tsx`) is left completely intact.
export function EditModuleDrawer({
  state,
  book,
  onClose,
  onSave,
}: EditModuleDrawerProps) {
  // Same Modal/Drawer-dismiss bridge as `EditModuleModal` -- see that
  // component's identical `requestCloseRef` doc. Every way Mantine's Drawer
  // can be dismissed (close button, Escape, outside click) funnels through
  // this one `onClose` prop, which `ModuleEditorBody` routes through its own
  // unsaved-changes guard before ever actually closing.
  const requestCloseRef = useRef(onClose);

  return (
    <Drawer
      opened={state !== null}
      onClose={() => requestCloseRef.current()}
      position="right"
      size={DRAWER_WIDTH}
    >
      {state && (
        <ModuleEditorBody
          // Remounts (a fresh local draft) per distinct edit target --
          // matching `EditModuleModal`'s own per-target remount.
          key={state.id}
          state={{ mode: "edit", id: state.id, fields: state.fields }}
          book={book}
          onClose={onClose}
          onSave={onSave}
          requestCloseRef={requestCloseRef}
          layout="narrow"
        />
      )}
    </Drawer>
  );
}
