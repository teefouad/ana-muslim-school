"use client";

import { ItemList } from "@/components/ui/item-list";
import styles from "./lessons-panel.module.css";
import { createMockLesson, type MockLesson } from "./mock-lessons";

export interface LessonsPanelProps {
  /** The Lessons list, in its current order. Fully controlled -- this
   * component owns no persistence, only the ItemList wiring (ANA-111,
   * mirroring ModulesPanel). */
  lessons: MockLesson[];
  onLessonsChange: (lessons: MockLesson[]) => void;
  /** The currently selected Lesson's id, if any (ANA-114) -- rendered
   * visually distinguished from the rest of the list. `null`/omitted
   * renders no row as selected. */
  selectedLessonId?: string | null;
  /** Fired when a row is clicked, selecting that Lesson (ANA-114) -- this
   * panel owns no selection state itself, only the ItemList wiring. Omitted
   * entirely leaves rows non-interactive, matching the pre-ANA-114
   * behavior. */
  onSelectLesson?: (lesson: MockLesson) => void;
  className?: string;
}

function getLessonLabel(lesson: MockLesson, index: number): string {
  return lesson.title.ar || lesson.title.en || `Lesson ${index + 1}`;
}

// The Lessons list inside the Edit Module modal's middle column (ANA-111) --
// visually and structurally mirrors ModulesPanel (see that file), built on
// the same reusable ItemList, but deliberately smaller: editing and deletion
// remain out of scope (ANA-110 covers the full Lesson editor and its
// delete), so no edit/delete affordance is wired here. Selection (ANA-114)
// is wired through `onSelectLesson`/`selectedItemId` instead of this panel
// owning any selection state of its own -- the caller (edit-module-modal.tsx)
// renders the selected Lesson's form in the third column. Reordering only
// ever updates `lessons` through `onLessonsChange` -- never persisted,
// matching Modules' own local-draft reorder. Add Lesson appends a local
// placeholder Lesson directly (see mock-lessons.ts) rather than opening a
// modal.
export function LessonsPanel({
  lessons,
  onLessonsChange,
  selectedLessonId = null,
  onSelectLesson,
  className,
}: LessonsPanelProps) {
  return (
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
      selectedItemId={selectedLessonId}
      onItemClick={
        onSelectLesson ? (lesson) => onSelectLesson(lesson) : undefined
      }
      addLabel="Add lesson"
      onAdd={() => onLessonsChange([...lessons, createMockLesson()])}
    />
  );
}
