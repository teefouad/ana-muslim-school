"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Group,
  Skeleton,
  Stack,
  Text,
  getDefaultZIndex,
} from "@mantine/core";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SortableList } from "@/components/ui/sortable-list";
import type { Lesson } from "@/lib/lessons/types";
import { getLessonLabel } from "./lessons-panel";
import styles from "./lessons-drawer-list.module.css";

const LOADING_ROW_COUNT = 3;

export interface LessonsDrawerListProps {
  /** This Module's real Lessons, in their current display order -- the
   * caller's own reorder draft layered onto the server list, same
   * contract as `LessonsPanel.lessons` (ANA-116/117). Fully controlled --
   * this component owns no persistence or loading of its own, only the
   * drag/edit/delete wiring. */
  lessons: Lesson[];
  /** True only for a first, blocking Lessons load (ANA-124) -- renders a
   * few skeleton rows instead of real cards, with no header/footer chrome
   * of its own (the drawer's own header is the only header for this
   * screen, per ANA-124). */
  loading?: boolean;
  /** Fired with the full reordered array once a drag actually changes the
   * order (never a persistence request) -- same contract as
   * `LessonsPanel.onLessonsChange`; the caller applies its own
   * `isValidReorder` guard and owns the pending-order draft. */
  onReorder: (lessons: Lesson[]) => void;
  onEditLesson: (lesson: Lesson) => void;
  /** Persists the deletion of a real Lesson through the caller's existing
   * Lesson delete behavior, gated behind the same `ConfirmDialog` pattern
   * `LessonsPanel` already uses. Rejecting leaves the card visible and
   * surfaces the error below the list. */
  onDeleteLesson: (lesson: Lesson) => Promise<void>;
  className?: string;
}

interface LessonCardProps {
  lesson: Lesson;
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

// One minimal Lesson row: drag handle, title/label, Edit, Delete -- no list
// header/footer/selection of its own (ANA-124's "purpose-built and
// minimal" list, deliberately not `ItemList`). Reuses `SortableList`'s
// lower-level DndContext/sensors/DragOverlay wiring the same way
// `ItemList`'s own `SortableRow` does, but with its own smaller markup
// instead of `RowChrome`'s full row chrome (selection, click/double-click,
// non-sortable fallback) -- none of which this drawer list needs.
function LessonCard({
  lesson,
  label,
  onEdit,
  onDelete,
  deleting,
}: LessonCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  return (
    <Box
      component="li"
      ref={setNodeRef}
      data-testid={`lessons-drawer-card-${lesson.id}`}
      className={[styles.card, isDragging && styles.cardDragging]
        .filter(Boolean)
        .join(" ")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Double-clicking a card opens the Lesson editor, same as its own
      // Edit action (ANA-129) -- matching ModulesPanel's/LessonsPanel's
      // identical double-click (modules-panel.tsx/lessons-panel.tsx).
      onDoubleClick={onEdit}
    >
      <span
        className={styles.grip}
        aria-hidden="true"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </span>
      <Text className={styles.label} fz={14}>
        {label}
      </Text>
      <Group gap={4} wrap="nowrap" className={styles.actions}>
        <ActionIconButton aria-label={`Edit ${label}`} onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" />
        </ActionIconButton>
        <ActionIconButton
          color="red"
          aria-label={`Delete ${label}`}
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
        </ActionIconButton>
      </Group>
    </Box>
  );
}

// The floating preview shown under the cursor while dragging -- structurally
// identical to the idle card (grip + label, no actions) so it doesn't drift
// from it, same reasoning as `ItemList`'s own `DefaultOverlay`. Rendered as
// a `div` (portaled outside the `<ul>`, see `SortableList`) rather than
// `li`, and non-interactive.
function LessonCardOverlay({
  label,
  width,
}: {
  label: string;
  width: number | null;
}) {
  return (
    <Box
      className={styles.card}
      style={{ pointerEvents: "none", ...(width != null ? { width } : {}) }}
    >
      <span className={styles.grip} aria-hidden="true">
        <GripVertical size={16} />
      </span>
      <Text className={styles.label} fz={14}>
        {label}
      </Text>
    </Box>
  );
}

// The Lessons drawer's own list content (ANA-124) -- a simple vertical list
// of minimal cards, not the ItemList-based `LessonsPanel`. Owns only its own
// delete-confirmation UI (mirrors `LessonsPanel`'s identical
// pendingDelete/isDeleting/deleteError pattern); reordering, editing, and
// the actual delete persistence are all the caller's existing behavior,
// passed straight through.
export function LessonsDrawerList({
  lessons,
  loading = false,
  onReorder,
  onEditLesson,
  onDeleteLesson,
  className,
}: LessonsDrawerListProps) {
  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDeleteRequest(lesson: Lesson) {
    setDeleteError(null);
    setPendingDelete(lesson);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteLesson(pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelDelete() {
    setPendingDelete(null);
    setDeleteError(null);
  }

  if (loading) {
    return (
      <Stack gap="xs" className={className} aria-hidden="true">
        {Array.from({ length: LOADING_ROW_COUNT }).map((_, index) => (
          <Skeleton key={index} height={40} radius={12} />
        ))}
      </Stack>
    );
  }

  if (lessons.length === 0) {
    return (
      <Box className={[styles.emptyState, className].filter(Boolean).join(" ")}>
        This module has no lessons yet.
      </Box>
    );
  }

  return (
    <>
      <SortableList<Lesson>
        items={lessons}
        getId={(lesson) => lesson.id}
        onReorder={onReorder}
        className={[styles.list, className].filter(Boolean).join(" ")}
        renderItem={(lesson, index) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            label={getLessonLabel(lesson, index)}
            onEdit={() => onEditLesson(lesson)}
            onDelete={() => handleDeleteRequest(lesson)}
            deleting={pendingDelete?.id === lesson.id && isDeleting}
          />
        )}
        renderOverlay={(lesson, index, width) => (
          <LessonCardOverlay
            label={getLessonLabel(lesson, index)}
            width={width}
          />
        )}
      />

      {deleteError && (
        <Box role="alert" c="red" fz="xs" mt="xs">
          {deleteError}
        </Box>
      )}

      {pendingDelete && (
        <ConfirmDialog
          opened
          title="Delete lesson?"
          description="This removes this Lesson. This action cannot be undone."
          confirmLabel="Delete lesson"
          cancelLabel="Cancel"
          isConfirming={isDeleting}
          onCancel={handleCancelDelete}
          onConfirm={() => void handleConfirmDelete()}
          // Same reasoning as the Module editor's own discard confirmation
          // (module-editor-body.tsx): this list only ever renders inside
          // the nested Lessons drawer, which gets a *stacked* z-index above
          // Mantine's default modal tier -- without this override the
          // confirmation would render underneath the drawer's own overlay.
          zIndex={getDefaultZIndex("popover")}
        />
      )}
    </>
  );
}
