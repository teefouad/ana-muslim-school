"use client";

import { useRef } from "react";
import { Modal } from "@mantine/core";

import type { Book } from "@/lib/books/types";
import { ModuleEditorBody, type ModuleEditorState } from "./module-editor-body";
import type { ModuleFieldsValues } from "./module-fields";

/** `"create"` opens the modal empty, with Save Module as its primary action
 * (ANA-94) -- clicking Add Module no longer inserts anything into the
 * Module list itself; that only happens once this modal's own backend
 * create request succeeds (see `[id]/edit/page.tsx`'s `handleCreateModule`).
 * `"edit"` seeds it from an existing, real Module's current fields, primary
 * action Save changes -- unchanged from ANA-91 except that saving now
 * persists through the backend instead of only updating local state. This
 * Module's Lessons (ANA-111) are no longer passed in -- `edit` mode loads
 * them itself via the existing Lesson list API, keyed off `book.id`/`id`
 * (ANA-116); create mode never shows a Lessons list at all (there is no
 * Module id yet to load Lessons for).
 *
 * The actual editing experience behind both modes is `ModuleEditorBody`
 * (`module-editor-body.tsx`), shared with the Edit Module drawer (ANA-121)
 * -- kept as a type alias here, not a redefinition, so existing imports of
 * `EditModuleModalState` keep working unchanged. Only editing an existing
 * Module was moved onto the drawer (`[id]/edit/page.tsx`'s `onEditModule`);
 * this modal itself, including its own `"edit"` mode, is otherwise untouched
 * and still fully functional -- ANA-121 is scoped to not alter or remove it. */
export type EditModuleModalState = ModuleEditorState;

export interface EditModuleModalProps {
  /** `null` closes the modal. */
  state: EditModuleModalState | null;
  /** The owning Book -- its `id` is what every AI action here sends as
   * `bookId` (the server always reloads the Book fresh from it for its own
   * Book-level context, never trusting client-sent Book fields, ANA-85),
   * and its Title/Description/Long description are read directly by this
   * modal's own AI context builders (ANA-98) -- the Edit Book page already
   * has the full `Book` loaded, so this needs no second fetch. */
  book: Book;
  onClose: () => void;
  /** Called with the modal's current field values when Save Module is
   * clicked in create mode. The modal awaits this -- resolving creates the
   * Module through the backend and closes the modal; rejecting keeps the
   * modal open and shows the error, without ever calling `onClose` itself
   * (ANA-94: "only add the Module to the list after creation succeeds"). */
  onCreate: (fields: ModuleFieldsValues) => Promise<void>;
  /** Called with the modal's current field values when Save changes is
   * clicked in edit mode. Same awaited resolve/reject contract as
   * `onCreate`. `lessonsOrder` (ANA-117) is this Module's current Lesson
   * display order -- a pending drag-and-drop reorder as its exact id list,
   * or `null` when the Lessons list was never reordered this session, in
   * which case the caller must leave the Module's persisted Lesson order
   * untouched rather than resend the order it happened to load with. */
  onSave: (
    id: string,
    fields: ModuleFieldsValues,
    lessonsOrder: string[] | null,
  ) => Promise<void>;
}

// Top-level modal (ANA-91) opened from the Edit Book screen's Modules panel
// -- deliberately a sibling of, not nested inside, the Module Builder modal
// (ImportSourceModal). Reused for both Add Module (create mode) and, until
// ANA-121 moved the pencil action onto the Edit Module drawer instead, the
// pencil action (edit mode) -- only the title, primary action label, and
// which callback Save invokes differ between the two, all handled by the
// shared `ModuleEditorBody`. This modal's own `"edit"` mode is left fully
// intact (ANA-121 scope): nothing currently opens it that way, but it's
// still exactly as capable as before, `layout` left at its `ModuleEditorBody`
// default (`"wide"`) so its rendered output is byte-for-byte unchanged.
export function EditModuleModal({
  state,
  book,
  onClose,
  onCreate,
  onSave,
}: EditModuleModalProps) {
  // Bridges every way Mantine's Modal can be dismissed (X button, Escape,
  // backdrop click -- all three funnel into this one `onClose` prop) through
  // whichever unsaved-changes guard `ModuleEditorBody` currently owns, since
  // only it tracks the fields'/Lesson-reorder draft's dirty state (PR
  // review: reorder Lessons, dismiss without saving -- no warning). Same
  // "funnel every dismiss path through one guard" precedent as Module
  // Builder's own `handleClose` (import-source-modal.tsx). Kept in sync via
  // an effect inside `ModuleEditorBody` rather than assigned directly during
  // render, so Mantine's own Modal (which only ever reads this while `state
  // !== null`, i.e. while a body is mounted to have already synced it) never
  // observes a stale guard.
  const requestCloseRef = useRef(onClose);

  return (
    <Modal
      opened={state !== null}
      onClose={() => requestCloseRef.current()}
      // Edit mode's own fixed 900px width (ANA-115 PR review) -- the same
      // for both Module mode (Module editor + Lessons list) and Lesson
      // mode (the Lesson editor takes over that same width), so the modal
      // never grows/shrinks when switching between them. Capped against
      // the viewport the same way Module Builder's own wide modal is
      // (import-source-modal.tsx), rather than a fixed size that would
      // overflow a narrow viewport.
      size={state?.mode === "edit" ? "min(1040px, calc(100vw - 48px))" : "lg"}
      centered
    >
      {state && (
        <ModuleEditorBody
          // Remounts (a fresh local draft) per distinct edit target, and
          // whenever create mode is (re-)entered after a different state --
          // matching BookForm/DeleteConfirmModal's own "T | null as the open
          // signal" pattern.
          key={state.mode === "create" ? "create" : state.id}
          state={state}
          book={book}
          onClose={onClose}
          onCreate={onCreate}
          onSave={onSave}
          requestCloseRef={requestCloseRef}
        />
      )}
    </Modal>
  );
}
