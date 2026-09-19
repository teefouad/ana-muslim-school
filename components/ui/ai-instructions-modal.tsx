"use client";

import { type ReactNode, useState } from "react";
import {
  Button,
  getDefaultZIndex,
  Group,
  Modal,
  Text,
  Textarea,
} from "@mantine/core";

export interface AiInstructionsModalProps {
  /** Always `true` in practice -- callers mount this modal only while the
   * Additional Instructions step is open (`{open && <AiInstructionsModal
   * ... />}`), matching ConfirmDialog's own conditional-mount pattern. Kept
   * as an explicit prop for parity with Mantine's own `Modal`. */
  opened: boolean;
  title: string;
  description: ReactNode;
  cancelLabel?: string;
  generateLabel?: string;
  onCancel: () => void;
  /** Called with the trimmed instructions, or `undefined` when left blank. */
  onGenerate: (instructions: string | undefined) => void;
}

// The "Additional Instructions" step every AI action (Translate with AI,
// AI Assistance) shares (ANA-96) -- extracted from the two near-identical
// dialogs it previously duplicated (edit-module-modal.tsx's AI Suggest
// dialog, learning-material-module-card.tsx's AI Assistant dialog) so a new
// AI action never has to reinvent this step. Carries no AI request logic of
// its own: the caller owns what "Generate" actually triggers.
export function AiInstructionsModal({
  opened,
  title,
  description,
  cancelLabel = "Cancel",
  generateLabel = "Generate",
  onCancel,
  onGenerate,
}: AiInstructionsModalProps) {
  const [instructions, setInstructions] = useState("");

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title}
      centered
      // Every caller reaches this dialog through a field's own AI action
      // (FormField), which can be rendered inside a *stacked* DrawerShell
      // (e.g. the Edit Module/Lesson editor drawers, ANA-129) -- that gets a
      // z-index above Mantine's default modal tier (see drawer-shell.tsx's
      // own `stackId` doc), which otherwise buries this dialog underneath
      // the drawer's own overlay instead of on top of it. Pinning to the
      // "popover" tier unconditionally is a no-op for every other caller
      // (an ordinary Modal/no drawer), matching the same override
      // `ConfirmDialog` callers already reach for in this situation.
      zIndex={getDefaultZIndex("popover")}
    >
      <Text size="sm" c="dimmed" mb="md">
        {description}
      </Text>
      <Textarea
        label="Additional instructions or context (optional)"
        value={instructions}
        onChange={(event) => setInstructions(event.currentTarget.value)}
        autosize
        minRows={3}
        maxRows={8}
        mb="lg"
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={() => onGenerate(instructions.trim() || undefined)}>
          {generateLabel}
        </Button>
      </Group>
    </Modal>
  );
}
