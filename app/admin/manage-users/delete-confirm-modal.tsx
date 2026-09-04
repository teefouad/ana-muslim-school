"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";

import type { PermissionRecord } from "@/lib/permissions/types";

export function DeleteConfirmModal({
  record,
  onClose,
}: {
  /** The record to delete; the modal is open whenever this is non-null. */
  record: PermissionRecord | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleDelete() {
    if (!record) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/permissions/${record.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal opened={record !== null} onClose={handleClose} title="Delete access">
      {record && (
        <Stack gap="md">
          <Text size="sm">
            Remove access for <strong>{record.email}</strong>? This only deletes
            the permission record -- it does not delete their Firebase
            Authentication account. This cannot be undone.
          </Text>

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
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
