"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemList } from "@/components/ui/item-list";
import type { Lesson } from "@/lib/lessons/types";
import styles from "./lessons-panel.module.css";

export interface LessonsPanelProps {
  /** This Module's Lessons, in their current order. Fully controlled --
   * this component owns no persistence, only the ItemList wiring
   * (ANA-111). */
  lessons: Lesson[];
  onLessonsChange: (lessons: Lesson[]) => void;
  /** Fired when a row's Edit action is clicked (ANA-115) -- switches Edit
   * Module into Lesson mode for this Lesson; this panel owns no editing UI
   * itself. Clicking the row itself no longer opens the form (ANA-115) --
   * Edit is the only entry point into Lesson mode. */
  onEditLesson: (lesson: Lesson) => void;
  /** Deletes a real, persisted Lesson through the existing Lesson DELETE
   * API (ANA-115) -- awaited the same way ModulesPanel's own
   * `onDeleteModule` is. Rejecting leaves the Lesson in the list and shows
   * the error; resolving is expected to have already revalidated the
   * caller's own Lessons data. */
  onDeleteLesson: (lesson: Lesson) => Promise<void>;
  /** Creates a new, real Lesson through the existing Lesson create API
   * (ANA-115) -- awaited the same way `onDeleteLesson` is; this panel
   * never inserts a client-generated Lesson into `lessons` itself. */
  onAddLesson: () => Promise<void>;
  className?: string;
}

function getLessonLabel(lesson: Lesson, index: number): string {
  return lesson.title.ar || lesson.title.en || `Lesson ${index + 1}`;
}

// The Lessons list inside the Edit Module modal's Module mode (ANA-111,
// polished in ANA-115) -- visually and structurally mirrors ModulesPanel
// (see that file), built on the same reusable ItemList. Add, Edit, and
// Delete are all real backend operations, matching ModulesPanel's own
// pattern: Edit switches Edit Module into Lesson mode via `onEditLesson`
// (never a nested modal), Delete persists through the Lesson DELETE API
// via `onDeleteLesson` behind the same ConfirmDialog pattern ModulesPanel
// uses, and Add creates a real Lesson via `onAddLesson`. Reordering only
// ever updates `lessons` through `onLessonsChange` -- never persisted,
// matching Modules' own local-draft reorder. Selection/click-to-open
// (ANA-114) is gone -- Edit is the only entry point into a Lesson's form.
export function LessonsPanel({
  lessons,
  onLessonsChange,
  onEditLesson,
  onDeleteLesson,
  onAddLesson,
  className,
}: LessonsPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleDeleteRequest(lesson: Lesson) {
    setActionError(null);
    setPendingDelete(lesson);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);

    try {
      await onDeleteLesson(pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelDelete() {
    setPendingDelete(null);
    setActionError(null);
  }

  async function handleAdd() {
    setActionError(null);
    setIsAdding(true);

    try {
      await onAddLesson();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsAdding(false);
    }
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
        onItemDoubleClick={(lesson) => onEditLesson(lesson)}
        getEditLabel={(lesson, index) =>
          `Edit ${getLessonLabel(lesson, index)}`
        }
        onDeleteItem={handleDeleteRequest}
        getDeleteLabel={(lesson, index) =>
          `Delete ${getLessonLabel(lesson, index)}`
        }
        deletingItemId={pendingDelete && isDeleting ? pendingDelete.id : null}
        error={actionError}
        addLabel="Add lesson"
        onAdd={() => void handleAdd()}
        addDisabled={isAdding}
      />
      {pendingDelete && (
        <ConfirmDialog
          opened
          title="Delete lesson?"
          description="This permanently deletes this Lesson. This action cannot be undone."
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
