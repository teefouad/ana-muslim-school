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
  className?: string;
}

function getLessonLabel(lesson: MockLesson, index: number): string {
  return lesson.title || `Lesson ${index + 1}`;
}

// The Lessons list inside the Edit Module modal's middle column (ANA-111) --
// visually and structurally mirrors ModulesPanel (see that file), built on
// the same reusable ItemList, but deliberately smaller: Lesson selection,
// editing, and deletion are all out of scope for this task (ANA-110 covers
// the full Lesson editor), so no edit/delete affordance is wired here.
// Reordering only ever updates `lessons` through `onLessonsChange` -- never
// persisted, matching Modules' own local-draft reorder. Add Lesson appends
// a local placeholder Lesson directly (see mock-lessons.ts) rather than
// opening a modal -- there is no Lesson form yet.
export function LessonsPanel({
  lessons,
  onLessonsChange,
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
      addLabel="Add lesson"
      onAdd={() => onLessonsChange([...lessons, createMockLesson()])}
    />
  );
}
