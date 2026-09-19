"use client";

import {
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";

import { FormField } from "@/components/ui/form-field";
import { ToggleCard } from "@/components/ui/toggle-card";
import { LESSON_TYPES, type LessonType } from "@/lib/lessons/types";
import type { Question } from "@/lib/questions/types";
import {
  suggestLessonDescription,
  suggestLessonTitle,
} from "./import-source/ai-assist-client";
import { translateArabicToEnglish } from "./import-source/translate-client";
import { LessonBreakConfig } from "./lesson-break-config";
import type { LessonFieldsValues } from "./lesson-fields";
import type { ModuleQuestionGroup } from "./question-fields";
import { QuestionsEditor } from "./questions-editor";

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

/** The container-width threshold (ANA-121) for `LessonForm`'s own top-level
 * two-column split -- see that `SimpleGrid`'s doc comment below for why this
 * has to be a literal length rather than the `sm` theme breakpoint token
 * `type="media"` elsewhere in this file still uses. Comfortably above the
 * Edit Module drawer's fixed 500px width (always 1 column there) and below
 * the Edit Module modal's ~1000px content width (still 2 columns there) --
 * and, same as the modal's own existing `sm`-viewport behavior, below any
 * width the modal itself would realistically shrink to on a narrow phone
 * viewport (`min(1040px, calc(100vw - 48px))"`), where 1 column is already
 * correct today. */
const LESSON_FORM_CONTAINER_BREAKPOINT = "640px";

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
  /** The owning Module's own current Arabic Title/Description/Learning
   * Material (ANA-116) -- read directly from the Edit Module modal's own
   * state, including any unsaved edits, never a fresh reload. Grounds both
   * Title's and Description's AI Assistance suggestions (never
   * Translate with AI, which stays the plain, context-free conversion it
   * already was). */
  moduleTitle: string;
  moduleDescription: string;
  moduleContent: string;
  /** Every Question currently loaded for the owning Module (ANA-119) --
   * forwarded to the Quiz/Final/Skip Questions editor's own Insert action,
   * unused by every other Lesson type's Configuration. */
  moduleQuestions: Question[];
  /** Every Question already defined in every Module before the owning one
   * in the Book's own Module order (ANA-120) -- also forwarded to Insert;
   * see `QuestionsEditorProps.previousModuleQuestions`'s own doc
   * (questions-editor.tsx). */
  previousModuleQuestions: ModuleQuestionGroup[];
  /** Mirrors Title's/Description's own Translate with AI and AI
   * Assistance request in-flight state (ANA-109/ANA-116), so the caller can
   * keep Save disabled while either is unresolved -- saving now would
   * persist the pre-translation/pre-suggestion value, and the AI result
   * would be lost once it lands after the editor has already returned to
   * Module mode. */
  onTitleBusyChange?: (busy: boolean) => void;
  onDescriptionBusyChange?: (busy: boolean) => void;
  /** Aggregates every Question card's own Translate request (ANA-119) --
   * same busy-gating contract as Title's/Description's own callbacks
   * above. */
  onQuestionsBusyChange?: (busy: boolean) => void;
}

// Renders the currently-selected Lesson type's own Configuration (ANA-118,
// Quiz/Final/Skip's own Questions editor added in ANA-119) -- `content`
// (Text)/`videoURL`+`duration` (Video)/`azkar` (Break)/`questions` (Quiz/
// Final/Skip) are all still kept in `value` regardless of `type` (see
// `LessonFieldsValues`'s own doc), so switching types back and forth only
// ever changes what's shown here, never what's held in the other types'
// fields.
function LessonTypeConfig({
  value,
  onChange,
  moduleQuestions,
  previousModuleQuestions,
  onQuestionsBusyChange,
}: Pick<
  LessonFormProps,
  | "value"
  | "onChange"
  | "moduleQuestions"
  | "previousModuleQuestions"
  | "onQuestionsBusyChange"
>) {
  switch (value.type) {
    case "text":
      return (
        <FormField
          label="Content"
          type="markdown"
          translatable
          value={value.content}
          onChange={(content) => onChange({ content })}
        />
      );

    case "video":
      return (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Video URL"
            value={value.videoURL}
            onChange={(event) =>
              onChange({ videoURL: event.currentTarget.value })
            }
          />
          <NumberInput
            label="Duration"
            min={0}
            value={value.duration}
            onChange={(duration) =>
              onChange({
                duration: typeof duration === "number" ? duration : 0,
              })
            }
          />
        </SimpleGrid>
      );

    case "break":
      return (
        <LessonBreakConfig
          value={value.azkar}
          onChange={(azkar) => onChange({ azkar })}
        />
      );

    case "quiz":
    case "final":
    case "skip":
      return (
        <QuestionsEditor
          questions={value.questions}
          onChange={(questions) => onChange({ questions })}
          moduleQuestions={moduleQuestions}
          previousModuleQuestions={previousModuleQuestions}
          onBusyChange={onQuestionsBusyChange}
        />
      );
  }
}

// The selected Lesson's fields form (ANA-114, expanded with type-specific
// Configuration in ANA-118, redesigned into a two-column layout with
// Quiz/Final/Skip's own Questions editor in ANA-119), rendered by
// lesson-editor.tsx once Edit switches Edit Module into Lesson mode
// (ANA-115). The left column (Position -> Title -> Description -> Published)
// covers the Lesson's own identity/visibility; the right column (Type ->
// the selected type's Configuration) covers what the Lesson actually shows
// learners -- equal-width on desktop, stacking to one column on narrow
// screens via the same two-column `SimpleGrid` convention this form already
// used for its old Type/Position row and Video's URL/Duration row -- except
// `type="container"` (ANA-121), so it responds to this form's own actual
// rendered width instead of the viewport's: this form renders unchanged
// inside the ~1000px-wide Edit Module modal (still comfortably over
// `LESSON_FORM_CONTAINER_BREAKPOINT`, so still 2 columns there), but the
// Edit Module *drawer*'s fixed 500px width is well under it, and a plain
// viewport-width check can't tell the two apart -- a wide desktop viewport
// with this form inside a narrow drawer would otherwise still measure
// "wide enough" and try to fit both columns into 500px, overlapping their
// content (caught visually in Storybook, not by jsdom tests, which never
// compute real layout). `LESSON_FORM_CONTAINER_BREAKPOINT` is a literal
// length (`"640px"`), not one of the theme's own named breakpoints (`sm`,
// `md`, ...) -- Mantine's `type="container"` only resolves a `cols` key
// through `theme.breakpoints` for `type="media"`; for `type="container"` it
// emits that key as a raw, unresolved `@container (min-width: <key>)`
// condition (see `SimpleGridContainerVariables` in
// `node_modules/@mantine/core/.../SimpleGridVariables.mjs`), so a theme
// token like `"sm"` becomes the invalid, never-matching `min-width: sm` and
// silently pins this grid to its `base` (single-column) value at every
// width -- caught by comparing rendered `grid-template-columns` inside and
// outside the drawer in Storybook, not by any test. The Video URL/Duration
// and Published/Position rows below stay on `type="media"` (viewport)
// unchanged -- each already gets its column's *own* full width once this
// outer grid has stacked to one column in the drawer, the same room the
// modal's ~500px-wide columns already give them today. Title/Description
// reuse FormField's existing translatable-
// field behavior: Translate with AI runs through the same plain, context-
// free `translateArabicToEnglish` boundary Book's own Title field already
// uses (book-form.tsx), while AI Assistance (ANA-116) runs through
// `suggestLessonTitle`/`suggestLessonDescription`, grounded in the owning
// Module's current Title/Description/Learning Material -- every other edit
// here only ever calls `onChange`, no network request.
export function LessonForm({
  value,
  onChange,
  moduleTitle,
  moduleDescription,
  moduleContent,
  moduleQuestions,
  previousModuleQuestions,
  onTitleBusyChange,
  onDescriptionBusyChange,
  onQuestionsBusyChange,
}: LessonFormProps) {
  return (
    <SimpleGrid
      type="container"
      flex={1}
      cols={{ base: 1, [LESSON_FORM_CONTAINER_BREAKPOINT]: 2 }}
      spacing="lg"
      data-testid="lesson-form"
    >
      <Stack gap="lg">
        <FormField
          label="Title"
          translatable
          value={value.title}
          onChange={(title) => onChange({ title })}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          onAiAssist={({ text, instructions }) =>
            suggestLessonTitle({
              text,
              additionalInstructions: instructions,
              moduleTitle,
              moduleDescription,
              moduleContent,
            })
          }
          // Suggest always generates Arabic (see suggest-lesson-title.ts's
          // base prompt) -- pinned here so running it while the English tab
          // is active can never write that Arabic result into `en` (ANA-116
          // PR review). Translate with AI is unaffected: it already only
          // ever reads `ar` and writes `en` on its own, regardless of the
          // active tab.
          aiAssistanceLanguage="ar"
          onBusyChange={onTitleBusyChange}
        />

        <FormField
          label="Description"
          translatable
          value={value.description}
          onChange={(description) => onChange({ description })}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          onAiAssist={({ text, instructions }) =>
            suggestLessonDescription({
              text,
              additionalInstructions: instructions,
              moduleTitle,
              moduleDescription,
              moduleContent,
            })
          }
          // See Title's identical `aiAssistanceLanguage` above (ANA-116 PR
          // review) -- Description's own Suggest is equally Arabic-only.
          aiAssistanceLanguage="ar"
          onBusyChange={onDescriptionBusyChange}
        />

        <SimpleGrid
          cols={{ base: 1, sm: 2 }}
          spacing="md"
          style={{ alignItems: "flex-end" }}
        >
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
        </SimpleGrid>
      </Stack>

      <Stack
        gap="lg"
        style={{
          border: "1px dashed #fff1",
          padding: 16,
          borderRadius: 12,
        }}
      >
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Type
          </Text>
          <SegmentedControl<LessonType>
            aria-label="Type"
            data={LESSON_TYPES.map((type) => ({
              value: type,
              label: LESSON_TYPE_LABELS[type],
            }))}
            value={value.type}
            onChange={(type) => onChange({ type })}
          />
        </Stack>

        <LessonTypeConfig
          value={value}
          onChange={onChange}
          moduleQuestions={moduleQuestions}
          previousModuleQuestions={previousModuleQuestions}
          onQuestionsBusyChange={onQuestionsBusyChange}
        />
      </Stack>
    </SimpleGrid>
  );
}
