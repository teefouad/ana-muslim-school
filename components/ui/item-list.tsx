"use client";

import { type CSSProperties, type ReactNode } from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Box, Group, Tooltip, UnstyledButton } from "@mantine/core";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import styles from "./item-list.module.css";
import { SortableList } from "./sortable-list";

export interface ItemListProps<T> {
  title: string;
  subtitle?: ReactNode;
  /** The list to render, in its current order. */
  items: T[];
  /** A stable, unique id for each item -- see `SortableListProps.getId`. */
  getItemId: (item: T) => string;
  /** The row's own label/content (e.g. "Section 3"). Rendered inside the
   * row alongside the drag grip (when `sortable`) and the edit/delete
   * actions (when their handlers are provided) -- all of which this
   * component owns so every list gets the same hover/focus/disabled
   * behavior instead of each caller re-implementing it. */
  renderItem: (item: T, index: number) => ReactNode;
  /** The floating preview shown under the cursor while dragging. Defaults
   * to the same `RowChrome` markup as the idle row (grip, `renderItem`'s
   * own output, and a reserved-but-disabled actions slot when edit/delete
   * are wired), pinned to the dragged row's own measured `width` -- which
   * is what most callers need -- only override this if a list needs a
   * differently shaped preview. */
  renderOverlay?: (item: T, index: number, width: number | null) => ReactNode;
  /** Shown instead of the list when `items` is empty. */
  emptyState: ReactNode;
  /** Whether rows can be dragged to reorder. When false, drag behavior is
   * never initialized (no DndContext/useSortable, no grip icon) rather than
   * merely disabled. */
  sortable: boolean;
  /** Fired with the full reordered array once a drag actually changes the
   * order. Required when `sortable` is true; persistence is left entirely
   * to the caller. */
  onReorder?: (items: T[]) => void;
  /** Temporarily suspends dragging without leaving `sortable` mode (e.g.
   * while a previous reorder request is still in flight). */
  reorderDisabled?: boolean;
  /** Fired when a row is clicked, outside of its drag grip and its edit/
   * delete actions. Entirely optional -- a plain click has no required
   * behavior; omit this to leave rows non-interactive. */
  onItemClick?: (item: T, index: number) => void;
  /** Fired when a row's edit action is clicked. Its presence is what
   * decides whether the edit affordance renders at all. */
  onEditItem?: (item: T, index: number) => void;
  /** The accessible label for a row's edit action. Required whenever
   * `onEditItem` is provided. */
  getEditLabel?: (item: T, index: number) => string;
  /** Disables every edit action (e.g. while another request is in
   * flight). */
  editDisabled?: boolean;
  /** Fired when a row's delete action is clicked. Its presence is what
   * decides whether the delete affordance renders at all -- omit it to
   * leave every row without one (e.g. for a read-only viewer). */
  onDeleteItem?: (item: T, index: number) => void;
  /** The accessible label for a row's delete action. Required whenever
   * `onDeleteItem` is provided. */
  getDeleteLabel?: (item: T, index: number) => string;
  /** Disables every delete action, independent of which single row is
   * mid-delete (see `deletingItemId`). */
  deleteDisabled?: boolean;
  /** The id of the row currently being deleted, if any -- disables just
   * that row's delete action for the duration of the request. */
  deletingItemId?: string | null;
  /** Rendered as an alert between the list and the Add footer, e.g. a
   * delete/reorder failure message. The caller decides the copy; this
   * component only renders it. */
  error?: ReactNode;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  /** Builds each row's `data-testid`. Defaults to `list-item-{id}`. */
  getItemTestId?: (item: T, id: string) => string;
  className?: string;
}

interface RowChromeProps {
  /** "li" for a real row inside `SortableList`'s `<ul>`; "div" for the
   * `DragOverlay` copy, which renders outside any list so a stray `<li>`
   * would pick up the browser's own list-item styling (e.g. a bullet). */
  component?: "li" | "div";
  testId: string;
  onClick?: () => void;
  showGrip: boolean;
  isDragging: boolean;
  editLabel?: string;
  onEdit?: () => void;
  editDisabled?: boolean;
  deleteLabel?: string;
  onDelete?: () => void;
  deleting?: boolean;
  deleteDisabled?: boolean;
  children: ReactNode;
  liRef?: (node: HTMLLIElement | null) => void;
  style?: CSSProperties;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
}

// The shared row markup -- optional click target, optional drag grip,
// optional edit/delete actions, hover/focus affordances -- used by both the
// sortable and the plain (non-sortable) row below. Only the drag ref/
// transform/listeners differ between the two, and only the grip itself
// carries them (a dedicated "drag handle"), so a click anywhere else on the
// row -- including the edit/delete actions -- can never be mistaken for a
// drag.
function RowChrome({
  component = "li",
  testId,
  onClick,
  showGrip,
  isDragging,
  editLabel,
  onEdit,
  editDisabled,
  deleteLabel,
  onDelete,
  deleting,
  deleteDisabled,
  children,
  liRef,
  style,
  dragAttributes,
  dragListeners,
}: RowChromeProps) {
  const canEdit = Boolean(onEdit);
  const canDelete = Boolean(onDelete);
  const contentClassName = [styles.content, !showGrip && styles.contentNoGrip]
    .filter(Boolean)
    .join(" ");

  return (
    <Box
      // Mantine's polymorphic `component` prop resolves to a single
      // overload from a literal, not a `"li" | "div"` union -- both
      // render identically at runtime regardless of which literal TS
      // picks, so this narrows purely to satisfy that overload matching.
      component={component as "li"}
      ref={liRef}
      data-testid={testId}
      style={style}
      className={`${styles.row} ${isDragging ? styles.rowDragging : ""}`}
    >
      {showGrip && (
        <span
          className={styles.grip}
          aria-hidden="true"
          {...dragAttributes}
          {...dragListeners}
        >
          <GripVertical size={16} />
        </span>
      )}

      {onClick ? (
        <UnstyledButton
          type="button"
          onClick={onClick}
          className={contentClassName}
          style={{ textAlign: "start" }}
        >
          {children}
        </UnstyledButton>
      ) : (
        <Box className={contentClassName}>{children}</Box>
      )}

      {(canEdit || canDelete) && (
        <Group gap={4} wrap="nowrap" className={styles.actions}>
          {canEdit && (
            <Tooltip label={editLabel} disabled={!editLabel}>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={editLabel}
                disabled={editDisabled}
                onClick={onEdit}
              >
                <Pencil size={14} aria-hidden="true" />
              </ActionIcon>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip label={deleteLabel} disabled={!deleteLabel}>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={deleteLabel}
                disabled={deleting || deleteDisabled}
                onClick={onDelete}
              >
                <Trash2 size={14} aria-hidden="true" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      )}
    </Box>
  );
}

// Reuses the exact same `RowChrome` markup as a resting row -- rendered as
// a "div" instead of "li" since this is portaled outside any `<ul>` -- so
// the floating preview under the cursor is structurally identical to the
// item's normal appearance (same width/height/padding/grip placement/
// reserved action slot), not an approximate re-implementation that can
// drift from it (ANA-80's hard acceptance criterion). `editLabel`/
// `deleteLabel` are passed through (with edit/delete forced disabled, and
// pointer events off entirely) purely so the actions group renders and
// reserves the same layout space as the idle row would -- this preview is
// never actually interactive. `width` pins the row to the dragged item's
// own measured width, since a portaled overlay has no container to
// naturally inherit one from.
function DefaultOverlay({
  testId,
  width,
  editLabel,
  onEdit,
  deleteLabel,
  onDelete,
  children,
}: {
  testId: string;
  width: number | null;
  editLabel?: string;
  onEdit?: () => void;
  deleteLabel?: string;
  onDelete?: () => void;
  children: ReactNode;
}) {
  return (
    <RowChrome
      component="div"
      testId={testId}
      showGrip
      isDragging={false}
      editLabel={editLabel}
      onEdit={onEdit}
      editDisabled
      deleteLabel={deleteLabel}
      onDelete={onDelete}
      deleteDisabled
      style={{
        pointerEvents: "none",
        ...(width != null ? { width } : {}),
      }}
    >
      {children}
    </RowChrome>
  );
}

// The reusable header/list/empty-state/Add-footer chrome for an ordered
// entity list (Sections, Items, Questions, and similar). Built on top of the
// lower-level `SortableList` primitive, which owns only the DndContext/
// sensors/DragOverlay wiring; this component owns everything else a real
// list needs: the header, empty state, per-row click/edit/delete
// affordances, and the Add footer. Feature callers keep their own
// persistence/loading/error handling entirely outside this component -- it
// only renders whatever `error` ReactNode it's given.
export function ItemList<T>({
  title,
  subtitle,
  items,
  getItemId,
  renderItem,
  renderOverlay,
  emptyState,
  sortable,
  onReorder,
  reorderDisabled = false,
  onItemClick,
  onEditItem,
  getEditLabel,
  editDisabled = false,
  onDeleteItem,
  getDeleteLabel,
  deleteDisabled = false,
  deletingItemId = null,
  error,
  addLabel,
  onAdd,
  addDisabled = false,
  getItemTestId,
  className,
}: ItemListProps<T>) {
  function testIdFor(item: T) {
    const id = getItemId(item);
    return getItemTestId ? getItemTestId(item, id) : `list-item-${id}`;
  }

  function overlayFor(item: T, index: number, width: number | null) {
    return renderOverlay ? (
      renderOverlay(item, index, width)
    ) : (
      <DefaultOverlay
        testId={testIdFor(item)}
        width={width}
        editLabel={getEditLabel?.(item, index)}
        onEdit={onEditItem ? () => {} : undefined}
        deleteLabel={getDeleteLabel?.(item, index)}
        onDelete={onDeleteItem ? () => {} : undefined}
      >
        {renderItem(item, index)}
      </DefaultOverlay>
    );
  }

  return (
    <Box
      className={[styles.card, className].filter(Boolean).join(" ")}
      // Resolves to the caller's own bounding box when it sets an explicit
      // height (or is itself a sized flex child) -- e.g. to scroll a long
      // list within a fixed-height panel -- and simply matches its natural
      // content height otherwise, since a percentage height falls back to
      // `auto` behavior against an `auto`-height parent.
    >
      <Box className={styles.header}>
        <Box className={styles.title}>{title}</Box>
        {subtitle && <Box className={styles.subtitle}>{subtitle}</Box>}
      </Box>

      {items.length === 0 ? (
        <Box className={styles.emptyState}>{emptyState}</Box>
      ) : sortable ? (
        <SortableList
          items={items}
          getId={getItemId}
          onReorder={onReorder ?? (() => {})}
          className={styles.body}
          renderItem={(item, index) => (
            <SortableRow
              key={getItemId(item)}
              id={getItemId(item)}
              testId={testIdFor(item)}
              onClick={onItemClick ? () => onItemClick(item, index) : undefined}
              reorderDisabled={reorderDisabled}
              editLabel={getEditLabel?.(item, index)}
              onEdit={onEditItem ? () => onEditItem(item, index) : undefined}
              editDisabled={editDisabled}
              deleteLabel={getDeleteLabel?.(item, index)}
              onDelete={
                onDeleteItem ? () => onDeleteItem(item, index) : undefined
              }
              deleting={deletingItemId === getItemId(item)}
              deleteDisabled={deleteDisabled}
            >
              {renderItem(item, index)}
            </SortableRow>
          )}
          renderOverlay={(item, index, width) => overlayFor(item, index, width)}
        />
      ) : (
        <Box component="ul" className={styles.body}>
          {items.map((item, index) => (
            <RowChrome
              key={getItemId(item)}
              testId={testIdFor(item)}
              onClick={onItemClick ? () => onItemClick(item, index) : undefined}
              showGrip={false}
              isDragging={false}
              editLabel={getEditLabel?.(item, index)}
              onEdit={onEditItem ? () => onEditItem(item, index) : undefined}
              editDisabled={editDisabled}
              deleteLabel={getDeleteLabel?.(item, index)}
              onDelete={
                onDeleteItem ? () => onDeleteItem(item, index) : undefined
              }
              deleting={deletingItemId === getItemId(item)}
              deleteDisabled={deleteDisabled}
            >
              {renderItem(item, index)}
            </RowChrome>
          ))}
        </Box>
      )}

      {error && (
        <Box role="alert" c="red" fz="xs" px="md" py="xs">
          {error}
        </Box>
      )}

      <Box className={styles.footer}>
        <UnstyledButton
          type="button"
          disabled={addDisabled}
          onClick={onAdd}
          className={styles.addButton}
        >
          <Plus size={16} aria-hidden="true" />
          {addLabel}
        </UnstyledButton>
      </Box>
    </Box>
  );
}

// The sortable row: wires `useSortable` (drag ref/transform/attributes/
// listeners) and hands the transform/attributes down to the shared
// `RowChrome` markup. Only rendered on the `sortable` code path, inside
// `SortableList`'s own `SortableContext`.
function SortableRow({
  id,
  testId,
  onClick,
  reorderDisabled,
  editLabel,
  onEdit,
  editDisabled,
  deleteLabel,
  onDelete,
  deleting,
  deleteDisabled,
  children,
}: {
  id: string;
  testId: string;
  onClick?: () => void;
  reorderDisabled: boolean;
  editLabel?: string;
  onEdit?: () => void;
  editDisabled?: boolean;
  deleteLabel?: string;
  onDelete?: () => void;
  deleting?: boolean;
  deleteDisabled?: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: reorderDisabled });

  return (
    <RowChrome
      testId={testId}
      onClick={onClick}
      showGrip
      isDragging={isDragging}
      editLabel={editLabel}
      onEdit={onEdit}
      editDisabled={editDisabled}
      deleteLabel={deleteLabel}
      onDelete={onDelete}
      deleting={deleting}
      deleteDisabled={deleteDisabled}
      liRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragAttributes={reorderDisabled ? undefined : attributes}
      dragListeners={reorderDisabled ? undefined : listeners}
    >
      {children}
    </RowChrome>
  );
}
