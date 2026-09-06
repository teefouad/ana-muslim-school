"use client";

import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";

import type { Book } from "@/lib/books/types";

function getBookLabel(book: Book): string {
  return book.title.ar || book.title.en || "this book";
}

// Delete confirmation for the Books CRUD UI. Owns the `DELETE
// /api/v1/books/{bookId}` request itself -- the same division of
// responsibility as app/admin/manage-users/delete-confirm-modal.tsx -- so
// callers only need to update their own list state via `onConfirm`, which
// fires after the request actually succeeds.
export function DeleteConfirmModal({
  book,
  onClose,
  onConfirm,
}: {
  /** The book to delete; the modal is open whenever this is non-null. */
  book: Book | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleDelete() {
    if (!book) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/v1/books/${book.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal opened={book !== null} onClose={handleClose} title="Delete book">
      {book && (
        <Stack gap="md">
          <Text size="sm">
            Delete <strong>{getBookLabel(book)}</strong>? This cannot be undone.
          </Text>

          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button color="red" loading={loading} onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
