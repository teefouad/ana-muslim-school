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
import type { LessonType } from "@/lib/lessons/types";
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
  quiz: "Quiz",
  final: "Final",
  skip: "Skip",
  break: "Break",
  text: "Text",
  video: "Video",
};

/** The Type control's own display order (ANA-126) -- Quiz, Final, Skip,
 * Break, Text, Video, deliberately separate from `LESSON_TYPES`
 * (lib/lessons/types.ts), which is the canonical/validation order and
 * unrelated to display. New Lesson's default type (Quiz, ANA-127) is its
 * own hardcoded value in `lesson-fields.ts`'s `createEmptyLessonFieldsValues`,
 * not derived from this list. This list only ever drives the
 * `SegmentedControl`'s own option order below. */
const LESSON_TYPE_ORDER: LessonType[] = [
  "quiz",
  "final",
  "skip",
  "break",
  "text",
  "video",
];

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
// Configuration in ANA-118, Quiz/Final/Skip's own Questions editor added in
// ANA-119), rendered by lesson-editor.tsx once Edit switches Edit Module
// into Lesson mode (ANA-115). Renders every field in a single column, in
// order: Title -> Description -> Position -> Type -> the selected type's
// Configuration -> Published, last, regardless of which type's own
// Configuration renders above it. Title/Description reuse FormField's
// existing translatable-field behavior: Translate with AI runs through the
// same plain, context-free `translateArabicToEnglish` boundary Book's own
// Title field already uses (book-form.tsx), while AI Assistance (ANA-116)
// runs through `suggestLessonTitle`/`suggestLessonDescription`, grounded in
// the owning Module's current Title/Description/Learning Material -- every
// other edit here only ever calls `onChange`, no network request. Position
// and Published each get their own full-width row rather than sharing one
// (PR review).
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
    <Stack gap="lg" flex={1} data-testid="lesson-form">
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
        // is active can never write that Arabic result into `en`
        // (ANA-116 PR review). Translate with AI is unaffected: it
        // already only ever reads `ar` and writes `en` on its own,
        // regardless of the active tab.
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

      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Type
        </Text>
        <SegmentedControl<LessonType>
          aria-label="Type"
          data={LESSON_TYPE_ORDER.map((type) => ({
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

      <ToggleCard
        label="Published"
        checked={value.isPublished}
        onChange={(isPublished) => onChange({ isPublished })}
      />
    </Stack>
  );
}
