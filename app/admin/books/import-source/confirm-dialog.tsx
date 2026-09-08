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

// A small, local confirmation-dialog primitive (ANA-75) for the Import
// Source modal's own destructive/discarding transitions -- "Discard unsaved
// changes?" on close, "Remove attached source?" before Select Another PDF's
// DELETE, and "Return to page selection?" before discarding a reviewed OCR
// result. Deliberately not promoted to components/ui: it has no reuse
// beyond this modal yet (see AGENTS.md's Storybook requirement for
// reusable components, which a components/ui promotion would trigger).
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
