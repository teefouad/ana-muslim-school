"use client";

import { useRef, useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { Pencil } from "lucide-react";

import { DrawerShell } from "@/components/ui/drawer-shell";
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

// Fixed 560px on desktop (ANA-123, previously 500px per ANA-121); `min(...)`
// caps it at the viewport width on anything narrower instead of overflowing
// horizontally, the same "shrink to fit, never overflow" contract
// `EditModuleModal`'s own edit-mode width already uses for its 1040px cap.
const DRAWER_WIDTH = "min(560px, 100vw)";

// The nested Lessons drawer (ANA-123) is a placeholder only -- no Lessons
// list/editor lives here yet (ANA-124) -- so it gets its own, narrower
// width rather than matching the Module editor's.
const LESSONS_DRAWER_WIDTH = "min(420px, 100vw)";

// Right-side drawer (ANA-121) opened from the Edit Book screen's Modules
// panel for the pencil action -- replaces the Edit Module modal for editing
// an existing Module only; Add Module is unaffected and still opens that
// modal in create mode. Renders the exact same Module-editing experience as
// the modal's own edit mode through the shared `ModuleEditorBody`
// (`module-editor-body.tsx`) -- same fields, AI actions, validation, loading
// states, save behavior, discard protection, and backend integration --
// just inside a different container, with `layout="narrow"`. The modal
// component itself (`edit-module-modal.tsx`) is left completely intact.
//
// The drawer's own chrome (header/footer) is the shared `DrawerShell`
// (ANA-122) -- its "Edit Module" title and back button replace the fixed-
// pixel-positioned `Title` `ModuleEditorBody` used to render for this
// container, and its footer is where `ModuleEditorBody`'s own Cancel/Save
// changes actions render via `DrawerFooter`, once `layout="narrow"` (see
// that component's own `isNarrow` branches).
//
// `ModuleEditorBody` no longer renders a Lessons list/editor for this
// `layout="narrow"` container (ANA-123 -- see its own `isNarrow` branch):
// that's replaced here by a Lessons header action that opens a second,
// nested `DrawerShell` stacked above this one via a shared Mantine
// `Drawer.Stack`, per `stackId` (ANA-122's own stacking support -- see
// `drawer-shell.tsx`'s `Stacked` story/tests for the exact mechanics this
// reuses). The nested drawer is an intentionally empty placeholder for now
// (ANA-124 implements the real Lessons list inside it); this only
// establishes the container/navigation shape. Opening/closing it is local
// UI state, entirely separate from `ModuleEditorBody`'s own dirty tracking,
// so it never marks the Module editor dirty.
export function EditModuleDrawer({
  state,
  book,
  onClose,
  onSave,
}: EditModuleDrawerProps) {
  // Same Modal/Drawer-dismiss bridge as `EditModuleModal` -- see that
  // component's identical `requestCloseRef` doc. Every way `DrawerShell`
  // can be dismissed (back button, Escape, outside click) funnels through
  // this one `onClose` prop, which `ModuleEditorBody` routes through its own
  // unsaved-changes guard before ever actually closing.
  const requestCloseRef = useRef(onClose);

  const [lessonsDrawerOpened, setLessonsDrawerOpened] = useState(false);

  // Resets the nested Lessons placeholder back to closed whenever the
  // Module editor itself actually closes, so reopening this same
  // `EditModuleDrawer` instance for a later Module never starts with a
  // stale nested drawer already open -- this component isn't remounted
  // between opens the way `ModuleEditorBody` is (see its own `key={state.
  // id}` below), so this local state would otherwise persist across them.
  function handleClose() {
    setLessonsDrawerOpened(false);
    onClose();
  }

  return (
    <Drawer.Stack>
      <DrawerShell
        opened={state !== null}
        title="Edit Module"
        onClose={() => requestCloseRef.current()}
        size={DRAWER_WIDTH}
        stackId="module"
        headerActions={
          // Same primary/filled styling as ModuleEditorBody's own Save
          // changes button (no `variant`, both fall back to Mantine's
          // default "filled" -- themed green via `--mantine-primary-color-
          // filled` in globals.css). Mantine's own Button styles don't
          // transition `background-color` on hover at all (PR review --
          // confirmed empirically, unlike NavLink/Table's own explicit
          // 150ms transitions in theme.ts), so the hover snaps instantly;
          // this adds that same 150ms ease here to match.
          <Button
            leftSection={<Pencil size={16} aria-hidden="true" />}
            onClick={() => setLessonsDrawerOpened(true)}
            style={{ transition: "background-color 150ms ease" }}
          >
            Lessons
          </Button>
        }
      >
        {state && (
          <ModuleEditorBody
            // Remounts (a fresh local draft) per distinct edit target --
            // matching `EditModuleModal`'s own per-target remount.
            key={state.id}
            state={{ mode: "edit", id: state.id, fields: state.fields }}
            book={book}
            onClose={handleClose}
            onSave={onSave}
            requestCloseRef={requestCloseRef}
            layout="narrow"
          />
        )}
      </DrawerShell>

      <DrawerShell
        opened={lessonsDrawerOpened}
        title="Lessons"
        onClose={() => setLessonsDrawerOpened(false)}
        onBack={() => setLessonsDrawerOpened(false)}
        size={LESSONS_DRAWER_WIDTH}
        stackId="lessons"
      >
        {null}
      </DrawerShell>
    </Drawer.Stack>
  );
}
