"use client";

import { useRef, useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { Pencil } from "lucide-react";

import { DrawerShell } from "@/components/ui/drawer-shell";
import type { Book } from "@/lib/books/types";
import { ModuleEditorBody, type ModuleEditorState } from "./module-editor-body";
import type { ModuleFieldsValues } from "./module-fields";

/** `null` closes the drawer; otherwise which Module editing session is open
 * -- `"create"` (ANA-129: Add Module opens this drawer, same as the pencil
 * action) or the existing Module being edited, its `id` and current field
 * values read fresh by the caller (see `[id]/edit/page.tsx`'s
 * `getModuleFields`). Reuses `ModuleEditorBody`'s own state union directly
 * rather than redefining an equivalent one. */
export type EditModuleDrawerState = ModuleEditorState | null;

export interface EditModuleDrawerProps {
  state: EditModuleDrawerState;
  /** The owning Book -- forwarded to `ModuleEditorBody` unchanged; see
   * `ModuleEditorBodyProps.book`'s identical doc. */
  book: Book;
  onClose: () => void;
  /** Called with the drawer's current field values when Save Module is
   * clicked in create mode. Optional, mirroring `ModuleEditorBody`'s own
   * optional `onCreate`, for a caller/test that only ever opens this drawer
   * in edit mode.
   *
   * Saving never closes this drawer (ANA-129 PR review) -- once this
   * resolves, the caller is expected to switch `state` from `"create"` to
   * `"edit"` for the newly created Module's real id (see `[id]/edit/
   * page.tsx`'s `handleCreateModule`), rather than nulling it. That gives
   * `ModuleEditorBody` a new `key` (this component's own render below),
   * so it remounts fresh in edit mode -- the drawer stays open throughout,
   * now showing the just-created Module instead of a blank create draft. */
  onCreate?: (fields: ModuleFieldsValues) => Promise<void>;
  /** Called with the drawer's current field values when Save changes is
   * clicked. */
  onSave: (
    id: string,
    fields: ModuleFieldsValues,
    lessonsOrder: string[] | null,
  ) => Promise<void>;
}

// Fixed 560px on desktop (ANA-123, previously 500px per ANA-121); `min(...)`
// caps it at the viewport width on anything narrower instead of overflowing
// horizontally.
const DRAWER_WIDTH = "min(560px, 100vw)";

// Right-side drawer (ANA-121) opened from the Edit Book screen's Modules
// panel for both the pencil action (edit mode) and, since ANA-129, Add
// Module (create mode) -- the Edit Module modal that used to own Add Module
// (`edit-module-modal.tsx`) was removed once this drawer became the only
// consumer of `ModuleEditorBody` (ANA-128). Renders the Module-editing
// experience through the shared `ModuleEditorBody` (`module-editor-body.tsx`)
// -- same fields, AI actions, validation, loading states, save behavior,
// discard protection, and backend integration.
//
// The drawer's own chrome (header/footer) is the shared `DrawerShell`
// (ANA-122) -- its "Edit Module" title and back button, and its footer is
// where `ModuleEditorBody`'s own Cancel/Save changes actions render via
// `DrawerFooter`.
//
// `ModuleEditorBody` renders no Lessons list/editor inline (ANA-123): that's
// replaced here by a Lessons header action that opens a second, nested
// `DrawerShell` stacked above this one via a shared Mantine `Drawer.Stack`,
// per `stackId` (ANA-122's own stacking support -- see `drawer-shell.tsx`'s
// `Stacked` story/tests for the exact mechanics this reuses). This
// component only owns the *open/closed* flag for that nested drawer
// (`lessonsDrawerOpened`, a plain navigation flag) -- its real content is
// rendered by `ModuleEditorBody` itself, which is where the Lessons
// data/handlers this drawer needs already live. It has no dirty-state or
// Save/Cancel of its own (ANA-126): reordering persists through the Module
// drawer's own Save changes, the same as every other Module field.
// `Drawer.Stack`'s context reaches it fine despite it being
// mounted several components deeper than this file's own `<Drawer.Stack>`
// -- React context, not DOM adjacency. Opening/closing this flag is local
// UI state, entirely separate from `ModuleEditorBody`'s own dirty tracking,
// so it never marks the Module editor dirty by itself.
export function EditModuleDrawer({
  state,
  book,
  onClose,
  onCreate,
  onSave,
}: EditModuleDrawerProps) {
  // Every way `DrawerShell` can be dismissed (back button, Escape, outside
  // click) funnels through this one `onClose` prop, which `ModuleEditorBody`
  // routes through its own unsaved-changes guard before ever actually
  // closing.
  const requestCloseRef = useRef(onClose);

  const [lessonsDrawerOpened, setLessonsDrawerOpened] = useState(false);

  // Keeps rendering the last real `state` throughout this drawer's own
  // closing slide-out transition, instead of unmounting `ModuleEditorBody`
  // the instant the caller nulls `state` in response to `onClose` (PR
  // review -- the same bug, and the same fix, as the nested Lesson editor
  // drawer's own `lessonEditorTarget`/`lessonEditorDrawerOpened` split,
  // module-editor-body.tsx: `state` is this component's *only* signal for
  // both "is the drawer open" and "what to render inside it", so nulling it
  // to close also wiped the content Mantine's exit transition needed to
  // animate away). Unlike that fix, `state` itself is an external prop this
  // component doesn't own, so it can't simply defer clearing it the way a
  // local `useState` setter could -- instead this mirrors it locally,
  // syncing to every new non-null `state` and otherwise holding the last
  // one. This is React's own documented "adjust state during render"
  // pattern (https://react.dev/learn/you-might-not-need-an-effect#adjusting-
  // some-state-when-a-prop-changes), not a ref or an effect: the
  // conditional `setRenderedState` call runs directly in the render body,
  // so React re-renders with the new value before committing, rather than
  // this component ever painting one frame behind the real `state`.
  const [renderedState, setRenderedState] = useState(state);
  if (state !== null && state !== renderedState) {
    setRenderedState(state);
  }

  // Resets the nested Lessons placeholder back to closed whenever the
  // Module editor itself actually closes, so reopening this same
  // `EditModuleDrawer` instance for a later Module never starts with a
  // stale nested drawer already open -- this component isn't remounted
  // between opens the way `ModuleEditorBody` is (see its own `key={
  // renderedState.id}` below), so this local state would otherwise persist
  // across them.
  function handleClose() {
    setLessonsDrawerOpened(false);
    onClose();
  }

  return (
    <Drawer.Stack>
      <DrawerShell
        opened={state !== null}
        title={renderedState?.mode === "create" ? "Add Module" : "Edit Module"}
        onClose={() => requestCloseRef.current()}
        size={DRAWER_WIDTH}
        stackId="module"
        // Only edit mode has any Lessons to manage -- create mode has no
        // Module id yet to load them for (ANA-129, matching
        // ModuleEditorBody's own "create mode never shows a Lessons list at
        // all", module-editor-body.tsx).
        headerActions={
          renderedState?.mode === "edit" ? (
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
          ) : undefined
        }
      >
        {renderedState && (
          <ModuleEditorBody
            // Remounts (a fresh local draft) per distinct edit target, and
            // whenever create mode is (re-)entered after a different state
            // (ANA-129).
            key={renderedState.mode === "create" ? "create" : renderedState.id}
            state={renderedState}
            book={book}
            onClose={handleClose}
            onCreate={onCreate}
            onSave={onSave}
            requestCloseRef={requestCloseRef}
            lessonsDrawerOpened={lessonsDrawerOpened}
            onLessonsDrawerClose={() => setLessonsDrawerOpened(false)}
          />
        )}
      </DrawerShell>
    </Drawer.Stack>
  );
}
