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
import { Box, Button, Group, Paper, Text } from "@mantine/core";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SortableList } from "@/components/ui/sortable-list";
import {
  makeQuestionFieldEntry,
  type QuestionFieldEntry,
} from "./question-fields";
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
  /** Aggregates every Question card's own Translate request into one flag
   * (ANA-119: "Save must not run while a Question translation request is
   * unresolved") -- called whenever the set of currently-translating cards
   * changes size, never via an effect (see the ref below). */
  onBusyChange?: (busy: boolean) => void;
}

// The Quiz/Final/Skip Lesson types' Questions configuration (ANA-119),
// matching the old admin's Questions editor layout and interaction pattern:
// a header (Questions label + New/Insert/Generate actions), an empty state,
// and a sortable list of collapsible Question cards. Only New is
// functional here -- Insert (the Question Bank picker) and Generate (AI
// generation) are dedicated follow-up tasks, rendered disabled in their
// correct positions. Built on the low-level `SortableList` primitive
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
  onBusyChange,
}: QuestionsEditorProps) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
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
          <Button
            variant="subtle"
            size="xs"
            px={0}
            leftSection={<Plus size={14} aria-hidden="true" />}
            onClick={handleAdd}
          >
            New
          </Button>
          <Button
            variant="subtle"
            size="xs"
            px={0}
            disabled
            leftSection={<ListPlus size={14} aria-hidden="true" />}
          >
            Insert
          </Button>
          <Button
            variant="subtle"
            size="xs"
            px={0}
            disabled
            leftSection={<Sparkles size={14} aria-hidden="true" />}
          >
            Generate
          </Button>
        </Group>
      </Group>

      {questions.length === 0 ? (
        <Box
          style={{
            border: "1px dashed var(--mantine-color-default-border)",
            borderRadius: "var(--mantine-radius-md)",
            padding: "var(--mantine-spacing-lg)",
            textAlign: "center",
          }}
        >
          <Text size="sm" c="dimmed">
            No questions yet.
          </Text>
        </Box>
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
        />
      )}
    </Box>
  );
}
