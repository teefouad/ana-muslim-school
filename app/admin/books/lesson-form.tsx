"use client";

import { SegmentedControl, Select, Stack, Text } from "@mantine/core";

import { FormField } from "@/components/ui/form-field";
import { ToggleCard } from "@/components/ui/toggle-card";
import { LESSON_TYPES, type LessonType } from "@/lib/lessons/types";
import { translateArabicToEnglish } from "./import-source/translate-client";
import type { LessonFieldsValues } from "./lesson-fields";

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
  /** The Lesson editor's current field values (ANA-114, simplified in
   * ANA-115). Fully controlled, mirroring BookForm's own pattern -- this
   * component owns no state of its own. Only one Lesson is ever open for
   * editing at a time now that Lesson mode replaces Edit Module's Module
   * editor entirely (ANA-115), so there's no longer a need to address
   * edits by Lesson id the way the old three-column layout's concurrent
   * Module+Lesson forms did. */
  value: LessonFieldsValues;
  /** Reports a partial update to apply on top of `value` -- the caller
   * (lesson-editor.tsx) holds the actual draft state; this form only ever
   * describes what changed. */
  onChange: (patch: Partial<LessonFieldsValues>) => void;
  /** Mirrors Title's/Description's own Translate with AI request's
   * in-flight state (ANA-109), so the caller can keep Save disabled while
   * either is unresolved -- saving now would persist the pre-translation
   * value, and the AI result would be lost once it lands after the editor
   * has already returned to Module mode. */
  onTitleBusyChange?: (busy: boolean) => void;
  onDescriptionBusyChange?: (busy: boolean) => void;
}

// The selected Lesson's basic-fields form (ANA-114), rendered by
// lesson-editor.tsx once Edit switches Edit Module into Lesson mode
// (ANA-115). Deliberately limited to Type/Title/One-line description/
// Published/Position -- Configuration and the Questions section are a
// later task (ANA-110). Title and One-line description reuse FormField's
// existing translatable-field behavior, with only Translate with AI wired
// (no AI Assistance, per the card) through the same plain, context-free
// `translateArabicToEnglish` boundary Book's own Title field already uses
// (book-form.tsx) -- translation is the only network request this form is
// allowed to make; every other edit here only ever calls `onChange`.
export function LessonForm({
  value,
  onChange,
  onTitleBusyChange,
  onDescriptionBusyChange,
}: LessonFormProps) {
  return (
    <Stack gap="lg" data-testid="lesson-form">
      <Select
        label="Type"
        data={LESSON_TYPES.map((type) => ({
          value: type,
          label: LESSON_TYPE_LABELS[type],
        }))}
        value={value.type}
        onChange={(type) => type && onChange({ type: type as LessonType })}
        allowDeselect={false}
      />

      <FormField
        label="Title"
        translatable
        value={value.title}
        onChange={(title) => onChange({ title })}
        aiTranslation
        onAiTranslate={({ text }) => translateArabicToEnglish(text)}
        onBusyChange={onTitleBusyChange}
      />

      <FormField
        label="One-line description"
        translatable
        value={value.description}
        onChange={(description) => onChange({ description })}
        aiTranslation
        onAiTranslate={({ text }) => translateArabicToEnglish(text)}
        onBusyChange={onDescriptionBusyChange}
      />

      <ToggleCard
        label="Published"
        checked={value.isPublished}
        onChange={(isPublished) => onChange({ isPublished })}
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
          value={value.position}
          onChange={(position) => onChange({ position })}
        />
      </Stack>
    </Stack>
  );
}
