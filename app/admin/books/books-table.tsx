"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Alert, Badge, Group, Loader, Stack, Text } from "@mantine/core";

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
    return (
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading books…
        </Text>
      </Group>
    );
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
