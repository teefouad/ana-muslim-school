"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Group, Stack, Text } from "@mantine/core";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useBooks } from "./books-store";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import type { MockBook } from "./mock-books";

function getBookLabel(book: MockBook): string {
  return book.title.ar || book.title.en || "Untitled book";
}

const columns: DataTableColumn<MockBook>[] = [
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
      <Badge color={book.locked ? "red" : "gray"} variant="light">
        {book.locked ? "Locked" : "Unlocked"}
      </Badge>
    ),
  },
  {
    key: "published",
    header: "Published",
    render: (book) => (
      <Badge color={book.published ? "green" : "gray"} variant="light">
        {book.published ? "Published" : "Draft"}
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
            backgroundColor: book.color,
            border: "1px solid var(--mantine-color-default-border)",
          }}
        />
        <Text size="sm">{book.color}</Text>
      </Group>
    ),
  },
];

// Presentation wrapper pairing the reusable DataTable (ANA-59) with the
// Books mock store (books-store.tsx) -- no Firestore/API calls, and any
// deletion only updates that in-memory state.
export function BooksTable() {
  const router = useRouter();
  const { books, removeBook } = useBooks();
  const [deletingBook, setDeletingBook] = useState<MockBook | null>(null);

  return (
    <>
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
          if (deletingBook) {
            removeBook(deletingBook.id);
          }
          setDeletingBook(null);
        }}
      />
    </>
  );
}
