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
   * own pattern -- this component owns no state of its own, every edit is
   * reported immediately through `onChange` with the whole updated Lesson.
   * Frontend-only local state; the caller (edit-module-modal.tsx) is what
   * actually holds it, alongside the rest of `lessons` -- nothing here is
   * loaded from or persisted to a backend (ANA-110 covers real Lesson
   * persistence). */
  lesson: MockLesson;
  onChange: (lesson: MockLesson) => void;
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
          type && onChange({ ...lesson, type: type as LessonType })
        }
        allowDeselect={false}
      />

      <FormField
        label="Title"
        translatable
        value={lesson.title}
        onChange={(title) => onChange({ ...lesson, title })}
        aiTranslation
        onAiTranslate={({ text }) => translateArabicToEnglish(text)}
      />

      <FormField
        label="One-line description"
        translatable
        value={lesson.description}
        onChange={(description) => onChange({ ...lesson, description })}
        aiTranslation
        onAiTranslate={({ text }) => translateArabicToEnglish(text)}
      />

      <ToggleCard
        label="Published"
        checked={lesson.isPublished}
        onChange={(isPublished) => onChange({ ...lesson, isPublished })}
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
          onChange={(position) => onChange({ ...lesson, position })}
        />
      </Stack>
    </Stack>
  );
}
