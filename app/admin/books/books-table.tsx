"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Alert,
  Badge,
  Group,
  Skeleton,
  Stack,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from "@mantine/core";

import { resolveApplicationColor } from "@/components/ui/application-colors";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { Book } from "@/lib/books/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { fetchJson } from "./fetch-json";

function getBookLabel(book: Book): string {
  return book.title.ar || book.title.en || "Untitled book";
}

const columns: DataTableColumn<Book>[] = [
  {
    key: "title",
    header: "Title",
    render: (book) => (
      <Stack gap={0}>
        <Text size="sm" dir="rtl">
          {book.title.ar || "—"}
        </Text>
        {book.title.en && (
          <Text size="xs" c="dimmed">
            {book.title.en}
          </Text>
        )}
      </Stack>
    ),
  },
  {
    key: "imageId",
    header: "In-app image ID",
    render: (book) =>
      book.imageId || (
        <Text c="dimmed" size="sm">
          —
        </Text>
      ),
  },
  {
    key: "locked",
    header: "Locked",
    render: (book) => (
      <Badge color={book.isLocked ? "red" : "gray"} variant="light">
        {book.isLocked ? "Locked" : "Unlocked"}
      </Badge>
    ),
  },
  {
    key: "published",
    header: "Published",
    render: (book) => (
      <Badge color={book.isPublished ? "green" : "gray"} variant="light">
        {book.isPublished ? "Published" : "Draft"}
      </Badge>
    ),
  },
  {
    key: "color",
    header: "Color",
    render: (book) => (
      <Group gap="xs" wrap="nowrap">
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: 4,
            backgroundColor: resolveApplicationColor(book.color),
            border: "1px solid var(--mantine-color-default-border)",
          }}
        />
        <Text size="sm">{book.color}</Text>
      </Group>
    ),
  },
];

const SKELETON_ROW_COUNT = 5;

// A row-and-column-shaped placeholder matching this table's own header and
// column count (ANA-104), swapped for the real DataTable as soon as the
// `/api/v1/books` request resolves -- so the row skips straight from this
// skeleton into loaded content with no layout shift. `aria-hidden` on the
// table itself keeps its decorative header/cells out of the accessibility
// tree; the wrapping `status` region's `aria-label` is what's announced.
function BooksTableSkeleton() {
  return (
    <div role="status" aria-label="Loading books">
      <TableScrollContainer minWidth={800}>
        <Table verticalSpacing="sm" aria-hidden="true">
          <TableThead>
            <TableTr>
              {columns.map((column) => (
                <TableTh key={column.key}>{column.header}</TableTh>
              ))}
            </TableTr>
          </TableThead>
          <TableTbody>
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
              <TableTr key={index}>
                <TableTd>
                  <Stack gap={4}>
                    <Skeleton height={14} width="70%" />
                    <Skeleton height={10} width="40%" />
                  </Stack>
                </TableTd>
                <TableTd>
                  <Skeleton height={14} width="50%" />
                </TableTd>
                <TableTd>
                  <Skeleton height={20} width={70} radius="sm" />
                </TableTd>
                <TableTd>
                  <Skeleton height={20} width={70} radius="sm" />
                </TableTd>
                <TableTd>
                  <Group gap="xs" wrap="nowrap">
                    <Skeleton height={14} width={14} radius={4} />
                    <Skeleton height={14} width={50} />
                  </Group>
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </TableScrollContainer>
    </div>
  );
}

// Presentation wrapper pairing the reusable DataTable (ANA-59) with the real
// `/api/v1/books` REST boundary (ANA-65) -- no Firestore/repository access
// from this Client Component. Uses SWR for the list read rather than a
// hand-rolled `useEffect` + `fetch`, per this Next.js version's documented
// client-side data-fetching guidance (see fetch-json.ts).
export function BooksTable() {
  const router = useRouter();
  const { data, error, mutate } = useSWR<{ data: Book[] }>(
    "/api/v1/books",
    fetchJson,
    { shouldRetryOnError: false },
  );
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);

  if (!data && !error) {
    return <BooksTableSkeleton />;
  }

  const books = data?.data ?? [];

  return (
    <Stack gap="md">
      {error && <Alert color="red">{error.message}</Alert>}

      <DataTable
        items={books}
        getItemId={(book) => book.id}
        columns={columns}
        emptyState="No books yet."
        minWidth={800}
        onEditItem={(book) => router.push(`/admin/books/${book.id}/edit`)}
        getEditLabel={(book) => `Edit ${getBookLabel(book)}`}
        onDeleteItem={setDeletingBook}
        getDeleteLabel={(book) => `Delete ${getBookLabel(book)}`}
      />

      <DeleteConfirmModal
        book={deletingBook}
        onClose={() => setDeletingBook(null)}
        onConfirm={() => {
          setDeletingBook(null);
          mutate();
        }}
      />
    </Stack>
  );
}
