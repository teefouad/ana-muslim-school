"use client";

import { ItemList } from "@/components/ui/item-list";
import styles from "./lessons-panel.module.css";
import type { Lesson } from "@/lib/lessons/types";

export interface LessonsPanelProps {
  /** The current Module's lessons, in their current order. Fully
   * controlled -- this component owns no persistence, only the ItemList
   * wiring (mirrors modules-panel.tsx, ANA-111). */
  lessons: Lesson[];
  /** Fired with the full reordered array once a drag actually changes the
   * order. The owning page persists this through the existing Lesson/Module
   * reorder flow and reconciles the result back into `lessons`; this panel
   * never persists anything itself. */
  onReorderLessons: (lessons: Lesson[]) => void;
  /** Suspends dragging while the owning page's reorder request is in
   * flight, without dropping out of sortable mode. */
  reorderDisabled?: boolean;
  /** Fired when Add lesson is clicked -- the owning page creates a real,
   * backend-backed Lesson from the existing/default Lesson fields and
   * reloads the list on success (ANA-111). This panel never inserts a
   * client-generated Lesson into `lessons` itself. */
  onAddLesson: () => void;
  /** Disables Add lesson while a create request is in flight. */
  addDisabled?: boolean;
  /** Surfaced between the list and the Add footer -- e.g. a failed reorder
   * or create request. The owning page decides the copy. */
  error?: string | null;
  className?: string;
}

function getLessonLabel(lesson: Lesson, index: number): string {
  return lesson.title.ar || lesson.title.en || `Lesson ${index + 1}`;
}

// The Lessons side panel for Edit Module (ANA-111) -- the first UI slice of
// Lesson management, deliberately scoped to sorting and adding Lessons only.
// Wraps the reusable ItemList around a caller-provided `lessons` list the
// same way modules-panel.tsx does for Modules; reorder/Add only ever call
// back out to the owning page, which owns all persistence (immediate for
// both, unlike Edit Book's Modules panel, which defers reorder to its own
// Save changes -- there's no larger Lesson form/save action on this page yet
// to bundle it into). Lesson selection, editing, deletion, and Question
// actions are out of scope for this task (ANA-110).
export function LessonsPanel({
  lessons,
  onReorderLessons,
  reorderDisabled = false,
  onAddLesson,
  addDisabled = false,
  error,
  className,
}: LessonsPanelProps) {
  return (
    <ItemList<Lesson>
      className={[className, styles.root].filter(Boolean).join(" ")}
      title="Lessons"
      subtitle={`${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}`}
      items={lessons}
      getItemId={(lesson) => lesson.id}
      renderItem={(lesson, index) => getLessonLabel(lesson, index)}
      emptyState="This module has no lessons yet."
      sortable
      onReorder={onReorderLessons}
      reorderDisabled={reorderDisabled}
      error={error}
      addLabel="Add lesson"
      onAdd={() => onAddLesson()}
      addDisabled={addDisabled}
    />
  );
}
