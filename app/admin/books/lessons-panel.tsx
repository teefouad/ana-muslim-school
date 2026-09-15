"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemList } from "@/components/ui/item-list";
import styles from "./lessons-panel.module.css";
import type { MockLesson } from "./mock-lessons";

export interface LessonsPanelProps {
  /** This Module's Lessons, in their current order. Fully controlled --
   * this component owns no persistence, only the ItemList wiring
   * (ANA-111). Frontend-only local data (ANA-111/ANA-114) -- real Lesson
   * loading/persistence is deferred to ANA-116. */
  lessons: MockLesson[];
  onLessonsChange: (lessons: MockLesson[]) => void;
  /** Fired when a row's Edit action is clicked (ANA-115) -- switches Edit
   * Module into Lesson mode for this Lesson; this panel owns no editing UI
   * itself. Clicking the row itself no longer opens the form, nor does
   * double-clicking it (ANA-115 PR review) -- Edit is the only entry point
   * into Lesson mode. */
  onEditLesson: (lesson: MockLesson) => void;
  /** Removes the given Lesson from local Lessons UI state only (ANA-115:
   * frontend-only, no Lesson API/Firestore write) -- gated behind the same
   * ConfirmDialog pattern ModulesPanel uses for its own persisted Delete,
   * since discarding a filled-in Lesson within the session is still worth
   * confirming even though nothing has been saved to a backend yet.
   * Synchronous -- there is no request to await and thus no failure path. */
  onDeleteLesson: (lesson: MockLesson) => void;
  /** Fired when New Lesson is clicked (ANA-115) -- switches Edit Module
   * into Lesson mode with a blank, id-less draft; this panel inserts
   * nothing into `lessons` itself. A Lesson only ever gets added to local
   * Lessons UI state once that editor's own Save changes is clicked (see
   * lesson-editor.tsx) -- New Lesson itself is a plain, synchronous
   * navigation. */
  onNewLesson: () => void;
  className?: string;
}

function getLessonLabel(lesson: MockLesson, index: number): string {
  return lesson.title.ar || lesson.title.en || `Lesson ${index + 1}`;
}

// The Lessons list inside the Edit Module modal's Module mode (ANA-111,
// polished in ANA-115) -- visually and structurally mirrors ModulesPanel
// (see that file), built on the same reusable ItemList. Edit switches Edit
// Module into Lesson mode via `onEditLesson` (never a nested modal), and
// Delete removes the Lesson from local UI state via `onDeleteLesson`
// behind the same ConfirmDialog pattern ModulesPanel uses for its own
// persisted Delete -- both are frontend-only in this task (ANA-115); real
// Lesson persistence is deferred to ANA-116. New Lesson is local
// navigation only -- it opens Lesson mode with no Lesson id and makes no
// request; the Lesson editor itself decides create vs. update solely from
// that id's presence, so there's no separate temporary Lesson object here
// to create or track. Reordering only ever updates `lessons` through
// `onLessonsChange` -- never persisted, matching Modules' own local-draft
// reorder. Selection/click-to-open (ANA-114) is gone -- Edit is the only
// entry point into a Lesson's form.
export function LessonsPanel({
  lessons,
  onLessonsChange,
  onEditLesson,
  onDeleteLesson,
  onNewLesson,
  className,
}: LessonsPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<MockLesson | null>(null);

  function handleDeleteRequest(lesson: MockLesson) {
    setPendingDelete(lesson);
  }

  function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    onDeleteLesson(pendingDelete);
    setPendingDelete(null);
  }

  function handleCancelDelete() {
    setPendingDelete(null);
  }

  return (
    <>
      <ItemList<MockLesson>
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
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
