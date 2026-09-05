"use client";

import type { ReactNode } from "react";
import {
  ActionIcon,
  Group,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Tooltip,
} from "@mantine/core";
import { Pencil, Trash2 } from "lucide-react";

import styles from "./data-table.module.css";

export interface DataTableColumn<T> {
  /** A stable key for the column, used as the React key for its header/cells. */
  key: string;
  header: ReactNode;
  render: (item: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  /** The rows to render, in the order given. */
  items: T[];
  /** A stable, unique id for each row -- used as the React key and passed to
   * `deletingItemId`/`getRowTestId`. */
  getItemId: (item: T) => string;
  /** The table's columns, in display order. Presentation only -- each
   * column's `render` decides what a cell shows for a given row. */
  columns: DataTableColumn<T>[];
  /** Shown instead of the table when `items` is empty. */
  emptyState: ReactNode;
  /** `min-width` the table scrolls horizontally below, passed through to
   * Mantine's `TableScrollContainer`. */
  minWidth?: number;
  /** Fired when a row's edit action is clicked. Its presence is what
   * decides whether the edit affordance -- and the actions column at all,
   * absent `onDeleteItem` too -- renders. */
  onEditItem?: (item: T, index: number) => void;
  /** The accessible label for a row's edit action. Required whenever
   * `onEditItem` is provided. */
  getEditLabel?: (item: T, index: number) => string;
  /** Disables every edit action (e.g. while another request is in
   * flight). */
  editDisabled?: boolean;
  /** Fired when a row's delete action is clicked. Its presence is what
   * decides whether the delete affordance renders at all. */
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
  /** Builds each row's `data-testid`. */
  getRowTestId?: (item: T, id: string) => string;
  className?: string;
}

// The reusable table presentation shared by Users, Books, and future
// dashboard lists: Mantine table primitives, a horizontal scroll container
// for narrower viewports, hover-highlighted rows, compact vertical spacing,
// and an optional right-side Edit/Delete action column. This component owns
// presentation only -- it knows nothing about permissions, books, modals,
// API calls, or Firebase; callers own their own record types, empty-state
// copy, and what happens when an action fires.
//
// Imports the `Table` subcomponents by their named exports rather than as
// `Table.Thead` etc. -- the compound-component properties resolve to
// `undefined` under Next's Turbopack dev bundler for this Mantine version.
export function DataTable<T>({
  items,
  getItemId,
  columns,
  emptyState,
  minWidth = 700,
  onEditItem,
  getEditLabel,
  editDisabled = false,
  onDeleteItem,
  getDeleteLabel,
  deleteDisabled = false,
  deletingItemId = null,
  getRowTestId,
  className,
}: DataTableProps<T>) {
  const canEdit = Boolean(onEditItem);
  const canDelete = Boolean(onDeleteItem);
  const hasActions = canEdit || canDelete;

  if (items.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {emptyState}
      </Text>
    );
  }

  return (
    <TableScrollContainer minWidth={minWidth} className={className}>
      <Table highlightOnHover verticalSpacing="sm">
        <TableThead>
          <TableTr>
            {columns.map((column) => (
              <TableTh key={column.key}>{column.header}</TableTh>
            ))}
            {hasActions && <TableTh />}
          </TableTr>
        </TableThead>
        <TableTbody>
          {items.map((item, index) => {
            const id = getItemId(item);
            const editLabel = getEditLabel?.(item, index);
            const deleteLabel = getDeleteLabel?.(item, index);
            const deleting = deletingItemId === id;

            return (
              <TableTr
                key={id}
                className={hasActions ? styles.row : undefined}
                data-testid={getRowTestId?.(item, id)}
              >
                {columns.map((column) => (
                  <TableTd key={column.key}>
                    {column.render(item, index)}
                  </TableTd>
                ))}
                {hasActions && (
                  <TableTd>
                    <Group gap="xs" wrap="nowrap" className={styles.actions}>
                      {canEdit && (
                        <Tooltip label={editLabel} disabled={!editLabel}>
                          <ActionIcon
                            variant="subtle"
                            aria-label={editLabel}
                            disabled={editDisabled}
                            onClick={() => onEditItem?.(item, index)}
                          >
                            <Pencil size={16} aria-hidden="true" />
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
                            onClick={() => onDeleteItem?.(item, index)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </TableTd>
                )}
              </TableTr>
            );
          })}
        </TableTbody>
      </Table>
    </TableScrollContainer>
  );
}
