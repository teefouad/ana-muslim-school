"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemList } from "@/components/ui/item-list";
import type { Lesson } from "@/lib/lessons/types";
import styles from "./lessons-panel.module.css";

export interface LessonsPanelProps {
  /** This Module's real, API-backed Lessons, in their current display
   * order (ANA-116). Fully controlled -- this component owns no
   * persistence or loading, only the ItemList wiring (ANA-111); the caller
   * (edit-module-modal.tsx) owns the Lessons SWR read. */
  lessons: Lesson[];
  onLessonsChange: (lessons: Lesson[]) => void;
  /** Fired when a row's Edit action is clicked (ANA-115) -- switches Edit
   * Module into Lesson mode for this Lesson; this panel owns no editing UI
   * itself. Clicking the row itself no longer opens the form, nor does
   * double-clicking it (ANA-115 PR review) -- Edit is the only entry point
   * into Lesson mode. */
  onEditLesson: (lesson: Lesson) => void;
  /** Persists the deletion of a real Lesson through the existing Lesson
   * delete API (ANA-116), gated behind the same `ConfirmDialog` pattern
   * ModulesPanel already uses for its own persisted Delete
   * (modules-panel.tsx). Rejecting leaves the Lesson visible and surfaces
   * the error alongside the list. */
  onDeleteLesson: (lesson: Lesson) => Promise<void>;
  /** Fired when New Lesson is clicked (ANA-115) -- switches Edit Module
   * into Lesson mode with a blank, id-less draft; this panel inserts
   * nothing into `lessons` itself. A Lesson is only ever created once that
   * editor's own Save changes succeeds (see lesson-editor.tsx) -- New
   * Lesson itself is a plain, synchronous navigation with no request. */
  onNewLesson: () => void;
  className?: string;
}

/** Exported for reuse by the Lessons drawer's own minimal card list
 * (`lessons-drawer-list.tsx`, ANA-124) -- same title-fallback rule, not a
 * second implementation of it. */
export function getLessonLabel(lesson: Lesson, index: number): string {
  return lesson.title.ar || lesson.title.en || `Lesson ${index + 1}`;
}

// The Lessons list inside the Edit Module modal's Module mode (ANA-111,
// polished in ANA-115, wired to the real Lesson backend in ANA-116) --
// visually and structurally mirrors ModulesPanel (see that file), built on
// the same reusable ItemList. Edit switches Edit Module into Lesson mode
// via `onEditLesson` (never a nested modal), and Delete persists through
// the Lesson DELETE API via `onDeleteLesson`, behind the same
// ConfirmDialog/`isDeleting`/`deleteError` pattern ModulesPanel's own
// persisted Delete uses. New Lesson is local navigation only -- it opens
// Lesson mode with no Lesson id and makes no request; the Lesson editor
// itself decides create vs. update solely from that id's presence, so
// there's no separate temporary Lesson object here to create or track.
// Reordering only ever updates `lessons` through `onLessonsChange` -- a
// local display-order draft the caller reconciles against the server order
// (see edit-module-modal.tsx's `lessonOrderDraft`); this task doesn't
// persist a reorder any more than ANA-115 did.
export function LessonsPanel({
  lessons,
  onLessonsChange,
  onEditLesson,
  onDeleteLesson,
  onNewLesson,
  className,
}: LessonsPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDeleteRequest(lesson: Lesson) {
    setDeleteError(null);
    setPendingDelete(lesson);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteLesson(pendingDelete);
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
      <ItemList<Lesson>
        className={[styles.root, className].filter(Boolean).join(" ")}
        title="Lessons"
        subtitle={`${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}`}
        items={lessons}
        getItemId={(lesson) => lesson.id}
        renderItem={(lesson, index) => getLessonLabel(lesson, index)}
        emptyState="This module has no lessons yet."
        sortable
        onReorder={onLessonsChange}
        onEditItem={(lesson) => onEditLesson(lesson)}
        getEditLabel={(lesson, index) =>
          `Edit ${getLessonLabel(lesson, index)}`
        }
        onDeleteItem={handleDeleteRequest}
        getDeleteLabel={(lesson, index) =>
          `Delete ${getLessonLabel(lesson, index)}`
        }
        deletingItemId={pendingDelete && isDeleting ? pendingDelete.id : null}
        error={deleteError}
        addLabel="New Lesson"
        onAdd={() => onNewLesson()}
      />
      {pendingDelete && (
        <ConfirmDialog
          opened
          title="Delete lesson?"
          description="This removes this Lesson. This action cannot be undone."
          confirmLabel="Delete lesson"
          cancelLabel="Cancel"
          isConfirming={isDeleting}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
