"use client";

import { Button, Group, Modal, Text } from "@mantine/core";

export interface ConfirmDialogProps {
  opened: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** True while the confirmed action is actually in flight -- shows a
   * loading state on the confirm button and blocks every way of dismissing
   * the dialog (Escape/backdrop/Cancel), so a slow request can't be raced
   * by a second click or an accidental close. */
  isConfirming?: boolean;
}

// A small, reusable confirmation-dialog primitive, introduced for the
// Import Source modal's own destructive/discarding transitions (ANA-75) --
// "Discard unsaved changes?" on close, "Remove attached source?" before
// Select Another PDF's DELETE, and "Return to page selection?" before
// discarding a reviewed OCR result -- and promoted to components/ui (ANA-77)
// once Module deletion and Learning Material translation needed the exact
// same confirm/cancel pattern from other parts of the Books admin (the Edit
// Book Modules list, the shared Module card) instead of duplicating it.
export function ConfirmDialog({
  opened,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title}
      centered
      closeOnEscape={!isConfirming}
      closeOnClickOutside={!isConfirming}
      withCloseButton={!isConfirming}
    >
      <Text size="sm" c="dimmed" mb="lg">
        {description}
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </Button>
        <Button color="red" loading={isConfirming} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
