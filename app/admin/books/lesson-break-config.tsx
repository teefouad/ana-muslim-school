"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Group,
  NumberInput,
  Paper,
  Text,
  getDefaultZIndex,
} from "@mantine/core";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DashedEmptyState } from "@/components/ui/dashed-empty-state";
import { ListHeaderAction } from "@/components/ui/list-header-action";
import { SortableList } from "@/components/ui/sortable-list";
import { TranslatableTextInput } from "@/components/ui/translatable-text-input";
import type { LanguageOption } from "@/components/ui/translatable-value";
import type { LessonAzkarFieldEntry } from "./lesson-fields";

const LANGUAGES: readonly LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

export interface LessonBreakConfigProps {
  value: LessonAzkarFieldEntry[];
  onChange: (value: LessonAzkarFieldEntry[]) => void;
}

function entryLabel(entry: LessonAzkarFieldEntry, index: number): string {
  return entry.text.ar || entry.text.en || `Entry ${index + 1}`;
}

// One Break entry's row content -- shared between the resting row (wrapped
// with drag/delete affordances by `SortableEntry` below) and the
// DragOverlay preview, so the preview can never visually drift from the
// real row (same principle as item-list.tsx's own DefaultOverlay).
function EntryFields({
  entry,
  index,
  onTextChange,
  onRepeatChange,
  disabled,
}: {
  entry: LessonAzkarFieldEntry;
  index: number;
  onTextChange: (text: LessonAzkarFieldEntry["text"]) => void;
  onRepeatChange: (repeat: number) => void;
  disabled?: boolean;
}) {
  return (
    <Group align="flex-end" gap="sm" wrap="wrap" style={{ flex: 1 }}>
      <Box style={{ flex: 2, minWidth: 200 }}>
        <TranslatableTextInput
          label={`Text ${index + 1}`}
          languages={LANGUAGES}
          value={entry.text}
          onChange={onTextChange}
          disabled={disabled}
        />
      </Box>
      <NumberInput
        label="Repeat"
        aria-label={`Repeat count for ${entryLabel(entry, index)}`}
        min={1}
        value={entry.repeat}
        onChange={(repeat) =>
          onRepeatChange(typeof repeat === "number" ? repeat : 1)
        }
        disabled={disabled}
        style={{ width: 100 }}
      />
    </Group>
  );
}

function SortableEntry({
  entry,
  index,
  onTextChange,
  onRepeatChange,
  onDelete,
}: {
  entry: LessonAzkarFieldEntry;
  index: number;
  onTextChange: (text: LessonAzkarFieldEntry["text"]) => void;
  onRepeatChange: (repeat: number) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  return (
    <Paper
      component="li"
      ref={setNodeRef}
      withBorder
      p="sm"
      data-testid={`break-entry-${entry.id}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        listStyle: "none",
      }}
    >
      <Group align="flex-end" gap="sm" wrap="nowrap">
        <Box
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${entryLabel(entry, index)}`}
          style={{
            display: "flex",
            alignSelf: "stretch",
            alignItems: "center",
            cursor: "grab",
            touchAction: "none",
            color: "var(--mantine-color-dimmed)",
          }}
        >
          <GripVertical size={16} aria-hidden="true" />
        </Box>

        <EntryFields
          entry={entry}
          index={index}
          onTextChange={onTextChange}
          onRepeatChange={onRepeatChange}
        />

        <ActionIconButton
          color="red"
          aria-label={`Delete ${entryLabel(entry, index)}`}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
        </ActionIconButton>
      </Group>
    </Paper>
  );
}

// The Break Lesson type's Configuration (ANA-118): a sortable list of
// `azkar` entries, each a translatable Text plus a numeric Repeat count --
// matching the old admin's Break configuration behavior. Built on the
// lower-level `SortableList` primitive rather than `ItemList` (see
// components/README.md) -- `ItemList`'s row chrome truncates its content to
// a single line for a plain text label, which doesn't fit this row's own
// always-visible, multi-field inline editor (there's no separate "Edit"
// step to route into first, unlike every other `ItemList` consumer in this
// admin). Fully controlled: the caller (lesson-form.tsx) owns `value`, the
// same `LessonFieldsValues.azkar` the rest of the Lesson form's fields live
// in, so switching away from and back to Break during one editing session
// never drops entries entered earlier (ANA-118).
export function LessonBreakConfig({ value, onChange }: LessonBreakConfigProps) {
  // Deleting a Break entry requires confirmation (ANA-129), matching the
  // Questions list's own `pendingDeleteKey` pattern (questions-editor.tsx)
  // instead of this list's previous instant, unconfirmed removal.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function handleAdd() {
    onChange([
      ...value,
      { id: crypto.randomUUID(), text: { ar: "", en: "" }, repeat: 1 },
    ]);
  }

  function handleTextChange(id: string, text: LessonAzkarFieldEntry["text"]) {
    onChange(
      value.map((entry) => (entry.id === id ? { ...entry, text } : entry)),
    );
  }

  function handleRepeatChange(id: string, repeat: number) {
    onChange(
      value.map((entry) => (entry.id === id ? { ...entry, repeat } : entry)),
    );
  }

  const pendingDeleteIndex = pendingDeleteId
    ? value.findIndex((entry) => entry.id === pendingDeleteId)
    : -1;

  return (
    <Box>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          Break entries
        </Text>
        <ListHeaderAction
          icon={<Plus size={14} aria-hidden="true" />}
          onClick={handleAdd}
        >
          Add entry
        </ListHeaderAction>
      </Group>

      {value.length === 0 ? (
        <DashedEmptyState>
          This lesson has no break entries yet.
        </DashedEmptyState>
      ) : (
        <SortableList<LessonAzkarFieldEntry>
          items={value}
          getId={(entry) => entry.id}
          onReorder={onChange}
          renderItem={(entry, index) => (
            <SortableEntry
              key={entry.id}
              entry={entry}
              index={index}
              onTextChange={(text) => handleTextChange(entry.id, text)}
              onRepeatChange={(repeat) => handleRepeatChange(entry.id, repeat)}
              onDelete={() => setPendingDeleteId(entry.id)}
            />
          )}
          renderOverlay={(entry, index) => (
            <Paper withBorder p="sm" style={{ pointerEvents: "none" }}>
              <Group align="flex-end" gap="sm" wrap="nowrap">
                <GripVertical size={16} aria-hidden="true" />
                <EntryFields
                  entry={entry}
                  index={index}
                  onTextChange={() => {}}
                  onRepeatChange={() => {}}
                  disabled
                />
              </Group>
            </Paper>
          )}
        />
      )}

      {pendingDeleteId && pendingDeleteIndex !== -1 && (
        <ConfirmDialog
          opened
          title={`Delete entry ${pendingDeleteIndex + 1}?`}
          description="This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            onChange(value.filter((entry) => entry.id !== pendingDeleteId));
            setPendingDeleteId(null);
          }}
          // This list renders inside the Lesson editor, which can be a
          // *stacked* DrawerShell (the nested Lesson editor drawer,
          // ANA-129) -- see module-editor-body.tsx's identical override for
          // why the default modal tier isn't enough there.
          zIndex={getDefaultZIndex("popover")}
        />
      )}
    </Box>
  );
}
