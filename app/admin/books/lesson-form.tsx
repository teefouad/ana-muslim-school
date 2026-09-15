"use client";

import { SegmentedControl, Select, Stack, Text } from "@mantine/core";

import { FormField } from "@/components/ui/form-field";
import { ToggleCard } from "@/components/ui/toggle-card";
import { LESSON_TYPES, type LessonType } from "@/lib/lessons/types";
import { translateArabicToEnglish } from "./import-source/translate-client";
import type { MockLesson } from "./mock-lessons";

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  text: "Text",
  video: "Video",
  quiz: "Quiz",
  final: "Final",
  skip: "Skip",
  break: "Break",
};

/** The Lesson position rules from ANA-110: `0` through `4`, segmented/
 * switcher-style control rather than a plain numeric input. */
const LESSON_POSITIONS = [0, 1, 2, 3, 4];

export interface LessonFormProps {
  /** The selected Lesson (ANA-114). Fully controlled, mirroring BookForm's
   * own pattern -- this component owns no state of its own. Frontend-only
   * local state; the caller (edit-module-modal.tsx) is what actually holds
   * it, alongside the rest of `lessons` -- nothing here is loaded from or
   * persisted to a backend (ANA-110 covers real Lesson persistence). */
  lesson: MockLesson;
  /** Reports a single-field patch for `lesson.id`, not the whole updated
   * Lesson (PR review, ANA-114) -- Translate with AI resolves
   * asynchronously, and each field's own `FormField`/control instance
   * closes over whatever `lesson` looked like at the moment it was
   * rendered. If a handler instead built and reported a whole `{
   * ...lesson, title }` object, a translation that resolves after some
   * *other* field changed (or after a second, concurrent translation on
   * this Lesson already resolved) would silently revert that other change
   * -- it would still be applying its own patch on top of the stale
   * snapshot it closed over. Reporting only the patch, and merging it
   * against the Lesson's *current* state in the parent's own functional
   * `setLessons` update, makes that impossible: every patch merges onto
   * whatever is actually there when it arrives, regardless of arrival
   * order. `lesson.id` is included since patches are unaddressed
   * otherwise -- id itself never changes for a given Lesson, so closing
   * over it (unlike any of its other fields) is always safe. */
  onChange: (id: string, patch: Partial<MockLesson>) => void;
}

// The selected Lesson's basic-fields form (ANA-114), rendered in Edit
// Module's third column once a Lesson is selected in the Lessons list
// (lessons-panel.tsx). Deliberately limited to Type/Title/One-line
// description/Published/Position -- Configuration and the Questions section
// are a later task (ANA-110). Title and One-line description reuse
// FormField's existing translatable-field behavior, with only Translate
// with AI wired (no AI Assistance, per the card) through the same plain,
// context-free `translateArabicToEnglish` boundary Book's own Title field
// already uses (book-form.tsx) -- translation is the only network request
// this form is allowed to make; every other edit here only ever calls
// `onChange`.
export function LessonForm({ lesson, onChange }: LessonFormProps) {
  return (
    <Stack gap="lg" data-testid="lesson-form">
      <Select
        label="Type"
        data={LESSON_TYPES.map((type) => ({
          value: type,
          label: LESSON_TYPE_LABELS[type],
        }))}
        value={lesson.type}
        onChange={(type) =>
          type && onChange(lesson.id, { type: type as LessonType })
        }
        allowDeselect={false}
      />

      <FormField
        label="Title"
        translatable
        value={lesson.title}
        onChange={(title) => onChange(lesson.id, { title })}
        aiTranslation
        onAiTranslate={({ text }) => translateArabicToEnglish(text)}
      />

      <FormField
        label="One-line description"
        translatable
        value={lesson.description}
        onChange={(description) => onChange(lesson.id, { description })}
        aiTranslation
        onAiTranslate={({ text }) => translateArabicToEnglish(text)}
      />

      <ToggleCard
        label="Published"
        checked={lesson.isPublished}
        onChange={(isPublished) => onChange(lesson.id, { isPublished })}
      />

      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Position
        </Text>
        <SegmentedControl<number>
          aria-label="Position"
          data={LESSON_POSITIONS.map((position) => ({
            value: position,
            label: String(position),
          }))}
          value={lesson.position}
          onChange={(position) => onChange(lesson.id, { position })}
        />
      </Stack>
    </Stack>
  );
}
