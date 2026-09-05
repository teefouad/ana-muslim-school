"use client";

import { Button, Group, Modal, Stack, Text } from "@mantine/core";

import type { MockBook } from "./mock-books";

function getBookLabel(book: MockBook): string {
  return book.title.ar || book.title.en || "this book";
}

// Frontend-only delete confirmation for the Books CRUD UI (ANA-60) -- confirming
// only removes the book from the caller's in-memory mock state (see
// books-store.tsx). There is no API call, so the book returns on reload.
export function DeleteConfirmModal({
  book,
  onClose,
  onConfirm,
}: {
  /** The book to delete; the modal is open whenever this is non-null. */
  book: MockBook | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal opened={book !== null} onClose={onClose} title="Delete book">
      {book && (
        <Stack gap="md">
          <Text size="sm">
            Delete <strong>{getBookLabel(book)}</strong>? This only removes it
            from this demo session -- it isn&apos;t saved anywhere, so it
            returns after the page reloads.
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button color="red" onClick={onConfirm}>
              Delete
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
