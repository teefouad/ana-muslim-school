"use client";

import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  ChevronDown,
  GripVertical,
  ListPlus,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Box, getDefaultZIndex, Group, Paper, Text } from "@mantine/core";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DashedEmptyState } from "@/components/ui/dashed-empty-state";
import {
  GenerateQuestionsModal,
  type GenerateQuestionsInput,
} from "@/components/ui/generate-questions-modal";
import { ListHeaderAction } from "@/components/ui/list-header-action";
import { SortableList } from "@/components/ui/sortable-list";
import type { Question } from "@/lib/questions/types";
import { generateQuestions } from "./generate-questions-client";
import {
  copyQuestionFromPreviousModule,
  fromGeneratedQuestion,
  makeQuestionFieldEntry,
  toQuestionFieldEntry,
  type ModuleQuestionGroup,
  type QuestionFieldEntry,
} from "./question-fields";
import {
  QuestionBankPicker,
  type QuestionBankCandidate,
} from "./question-bank-picker";
import { QuestionTextEditor } from "./question-text-editor";

function questionSummary(entry: QuestionFieldEntry): string {
  return entry.text.ar?.trim() || entry.text.en?.trim() || "Untitled question";
}

function QuestionCardHeader({
  index,
  entry,
  collapsed,
  onToggleCollapsed,
  onDelete,
  attributes,
  listeners,
}: {
  index: number;
  entry: QuestionFieldEntry;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onDelete: () => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}) {
  return (
    <Group gap="xs" wrap="nowrap">
      {/* A real <button>, not a <span>/plain <div>, so the drag handle
          stays keyboard-reachable and operable on its own (dnd-kit's
          KeyboardSensor needs a focusable element with its own click/
          keydown handling) -- matching the old admin's own Question
          card grip. */}
      <Box
        component="button"
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder question ${index}`}
        style={{
          display: "flex",
          alignSelf: "stretch",
          alignItems: "center",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "grab",
          touchAction: "none",
          color: "var(--mantine-color-dimmed)",
        }}
      >
        <GripVertical size={16} aria-hidden="true" />
      </Box>

      <Box
        component="button"
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        style={{
          display: "flex",
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          gap: 8,
          textAlign: "start",
          background: "none",
          border: "none",
          padding: "4px 0",
          cursor: "pointer",
        }}
      >
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "var(--mantine-color-dimmed)",
            transform: collapsed ? "rotate(-90deg)" : undefined,
            transition: "transform 150ms",
          }}
        />
        <Text
          size="xs"
          fw={600}
          tt="uppercase"
          c="dimmed"
          style={{ flexShrink: 0 }}
        >
          Question {index}
        </Text>
        {collapsed && (
          <Text
            size="xs"
            c="dimmed"
            truncate
            dir="auto"
            style={{ minWidth: 0, flex: 1 }}
          >
            {questionSummary(entry)}
          </Text>
        )}
      </Box>

      <ActionIconButton
        color="red"
        aria-label={`Remove question ${index}`}
        onClick={onDelete}
      >
        <Trash2 size={16} aria-hidden="true" />
      </ActionIconButton>
    </Group>
  );
}

function QuestionCard({
  index,
  entry,
  collapsed,
  onToggleCollapsed,
  onChange,
  onDelete,
  onBusyChange,
}: {
  index: number;
  entry: QuestionFieldEntry;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onChange: (entry: QuestionFieldEntry) => void;
  onDelete: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.key });

  return (
    <Paper
      component="li"
      ref={setNodeRef}
      withBorder
      p="sm"
      data-testid={`question-card-${entry.key}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        listStyle: "none",
      }}
    >
      <QuestionCardHeader
        index={index}
        entry={entry}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        onDelete={onDelete}
        attributes={attributes}
        listeners={listeners}
      />

      {!collapsed && (
        <Box mt="sm">
          <QuestionTextEditor
            question={entry}
            onChange={onChange}
            onTranslatingChange={onBusyChange}
          />
        </Box>
      )}
    </Paper>
  );
}

export interface QuestionsEditorProps {
  questions: QuestionFieldEntry[];
  onChange: (questions: QuestionFieldEntry[]) => void;
  /** Every Question currently loaded for the owning Module (ANA-119) --
   * the Insert action's Question Bank picker offers these as-is (reusing
   * the real id on selection), excluding whichever of them are already
   * linked into `questions` below. Threaded straight through from
   * lesson-editor.tsx's own `moduleQuestions` (already loaded to seed this
   * list when opening an existing Lesson, see lesson-fields.ts's
   * `toLessonFieldsValues`) rather than fetched again. */
  moduleQuestions: Question[];
  /** Every Question already defined in every Module *before* the owning one
   * in the Book's own Module order (ANA-120) -- Insert also offers these,
   * but a selection is copied into a brand-new, unpersisted draft rather
   * than referencing the source id directly (the School schema requires
   * `Lesson.questions` ids to resolve under the Lesson's own Module; see
   * `copyQuestionFromPreviousModule`). A later Module's Questions are never
   * offered. Empty for New Lesson's owning Module when it's the Book's
   * first, or while this Book-wide read (ANA-108's
   * `GET /api/v1/books/{bookId}/questions`) hasn't resolved/has failed --
   * Insert simply has fewer previous-Module results in that case, never
   * blocking the Lesson editor the way a failed *current*-Module Questions
   * load does. */
  previousModuleQuestions: ModuleQuestionGroup[];
  /** Aggregates every Question card's own Translate request into one flag
   * (ANA-119: "Save must not run while a Question translation request is
   * unresolved") -- called whenever the set of currently-translating cards
   * changes size, never via an effect (see the ref below). */
  onBusyChange?: (busy: boolean) => void;
}

// The Quiz/Final/Skip Lesson types' Questions configuration (ANA-119,
// New/Insert header styling and Insert's own Question Bank picker added in
// ANA-120, Generate's AI question generation added in ANA-131), matching the
// old admin's Questions editor layout and interaction pattern: a header
// (Questions label + New/Insert/Generate actions), an empty state, and a
// sortable list of collapsible Question cards. Built on the low-level
// `SortableList` primitive
// rather than `ItemList`, for the same reason lesson-break-config.tsx is:
// each row is an always-visible, multi-field inline editor, not a
// single-line label with a separate "Edit" step to route into. Fully
// controlled: the caller (lesson-form.tsx) owns `questions`, the same
// `LessonFieldsValues.questions` the rest of the Lesson form's fields live
// in, so switching away from and back to Quiz/Final/Skip during one
// editing session never drops Questions entered earlier.
export function QuestionsEditor({
  questions,
  onChange,
  moduleQuestions,
  previousModuleQuestions,
  onBusyChange,
}: QuestionsEditorProps) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  // Whether the Insert action's Question Bank picker is open (ANA-120) --
  // local UI state only, so opening/closing it alone never marks the Lesson
  // dirty; only an actual selection (which calls `onChange`) does.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Generate (ANA-131): the modal's own open/loading/error state. Unlike
  // Insert's picker, a Generate request is an actual network call, so it
  // needs its own in-flight/error tracking -- the modal stays open and
  // `generateError` is shown inside it on failure (rather than closing the
  // modal the way AI Assistance's instructions dialog does), so a failed
  // request never loses the passage/instructions already typed into it.
  const [generateOpen, setGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // Which Question cards currently have a Translate request in flight --
  // a ref, not state, since nothing here needs to re-render on this
  // changing; it exists solely to aggregate each card's own busy flag
  // into the one `onBusyChange` call the Lesson editor gates Save on,
  // called directly from the event-driven callback below rather than via
  // an effect (this admin's `react-hooks/set-state-in-effect` lint rule
  // flags a setState reachable from an effect; this call happens inline
  // in a callback flow instead).
  const busyKeysRef = useRef<Set<string>>(new Set());

  function toggleCollapsed(key: string) {
    setCollapsedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleQuestionBusyChange(key: string, busy: boolean) {
    const next = new Set(busyKeysRef.current);
    if (busy) {
      next.add(key);
    } else {
      next.delete(key);
    }
    busyKeysRef.current = next;
    onBusyChange?.(next.size > 0);
  }

  function handleAdd() {
    onChange([...questions, makeQuestionFieldEntry()]);
  }

  function handleGenerateClick() {
    setGenerateError(null);
    setGenerateOpen(true);
  }

  function handleGenerateCancel() {
    if (isGenerating) {
      return;
    }
    setGenerateOpen(false);
    setGenerateError(null);
  }

  async function handleGenerateSubmit(input: GenerateQuestionsInput) {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const generated = await generateQuestions(input);
      onChange([...questions, ...generated.map(fromGeneratedQuestion)]);
      setGenerateOpen(false);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  // Every persisted current-Module Question id already linked into this
  // Lesson -- excluded from the Insert picker's current-Module results
  // (ANA-120). A brand-new, unsaved Question draft (`id === null`) never
  // affects this set.
  const excludeCurrentModuleIds = new Set(
    questions
      .map((question) => question.id)
      .filter((id): id is string => id !== null),
  );

  // Every previous-Module source Question already copied into this
  // Lesson's draft this session -- excluded from the Insert picker's
  // previous-Module results so the same source Question can't be inserted
  // twice (ANA-120). Keyed by source identity, not the copy's own `id`
  // (always `null` pre-Save; see `copyQuestionFromPreviousModule`).
  const excludePreviousModuleSources = new Set(
    questions
      .filter(
        (question) => question.sourceModuleId && question.sourceQuestionId,
      )
      .map(
        (question) => `${question.sourceModuleId}:${question.sourceQuestionId}`,
      ),
  );

  const insertCandidates: QuestionBankCandidate[] = [
    ...moduleQuestions
      .filter((question) => !excludeCurrentModuleIds.has(question.id))
      .map((question): QuestionBankCandidate => ({
        question,
        isCurrentModule: true,
      })),
    ...previousModuleQuestions.flatMap((group) =>
      group.questions
        .filter(
          (question) =>
            !excludePreviousModuleSources.has(
              `${group.moduleId}:${question.id}`,
            ),
        )
        .map((question): QuestionBankCandidate => ({
          question,
          isCurrentModule: false,
          moduleId: group.moduleId,
        })),
    ),
  ];

  function handleInsert(candidate: QuestionBankCandidate) {
    const entry = candidate.isCurrentModule
      ? toQuestionFieldEntry(candidate.question)
      : copyQuestionFromPreviousModule(candidate.question, candidate.moduleId);
    onChange([...questions, entry]);
    setPickerOpen(false);
  }

  const pendingDeleteIndex = pendingDeleteKey
    ? questions.findIndex((question) => question.key === pendingDeleteKey)
    : -1;

  return (
    <Box>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          Questions
        </Text>
        <Group gap="md">
          <ListHeaderAction
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={handleAdd}
          >
            New
          </ListHeaderAction>
          <ListHeaderAction
            icon={<ListPlus size={14} aria-hidden="true" />}
            onClick={() => setPickerOpen(true)}
          >
            Insert
          </ListHeaderAction>
          <ListHeaderAction
            icon={<Sparkles size={14} aria-hidden="true" />}
            onClick={handleGenerateClick}
          >
            Generate
          </ListHeaderAction>
        </Group>
      </Group>

      {questions.length === 0 ? (
        <DashedEmptyState>No questions yet.</DashedEmptyState>
      ) : (
        <SortableList<QuestionFieldEntry>
          items={questions}
          getId={(question) => question.key}
          onReorder={onChange}
          className="flex flex-col gap-2"
          renderItem={(entry, index) => (
            <QuestionCard
              key={entry.key}
              index={index + 1}
              entry={entry}
              collapsed={collapsedKeys.has(entry.key)}
              onToggleCollapsed={() => toggleCollapsed(entry.key)}
              onChange={(updated) =>
                onChange(
                  questions.map((question) =>
                    question.key === updated.key ? updated : question,
                  ),
                )
              }
              onDelete={() => setPendingDeleteKey(entry.key)}
              onBusyChange={(busy) => handleQuestionBusyChange(entry.key, busy)}
            />
          )}
          renderOverlay={(entry, index) => (
            <Paper withBorder p="sm" style={{ pointerEvents: "none" }}>
              <Group gap="xs">
                <GripVertical size={16} aria-hidden="true" />
                <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                  Question {index + 1}
                </Text>
              </Group>
            </Paper>
          )}
        />
      )}

      {pendingDeleteKey && pendingDeleteIndex !== -1 && (
        <ConfirmDialog
          opened
          title={`Delete question ${pendingDeleteIndex + 1}?`}
          description="This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setPendingDeleteKey(null)}
          onConfirm={() => {
            onChange(
              questions.filter((question) => question.key !== pendingDeleteKey),
            );
            setPendingDeleteKey(null);
          }}
          // This editor renders inside the Lesson editor, which can be a
          // *stacked* DrawerShell (the nested Lesson editor drawer,
          // ANA-129) -- see module-editor-body.tsx's identical override for
          // why the default modal tier isn't enough there.
          zIndex={getDefaultZIndex("popover")}
        />
      )}

      {pickerOpen && (
        <QuestionBankPicker
          opened
          candidates={insertCandidates}
          onSelect={handleInsert}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {generateOpen && (
        <GenerateQuestionsModal
          opened
          isGenerating={isGenerating}
          error={generateError}
          onCancel={handleGenerateCancel}
          onGenerate={(input) => void handleGenerateSubmit(input)}
        />
      )}
    </Box>
  );
}
