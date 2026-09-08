import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ConfirmDialog } from "./confirm-dialog";

const meta = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  args: {
    opened: true,
    title: "Discard unsaved changes?",
    description: "Your changes have not been saved and will be lost.",
    confirmLabel: "Discard changes",
    cancelLabel: "Keep editing",
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DiscardChanges: Story = {};

export const RemoveSource: Story = {
  args: {
    title: "Remove attached source?",
    description:
      "This removes the Source Text attached to this book and returns to PDF upload. Existing Modules and Learning Materials will not be deleted. Any unsaved changes in this modal will also be lost.",
    confirmLabel: "Remove source",
    cancelLabel: "Keep source",
  },
};

export const ReturnToPageSelection: Story = {
  args: {
    title: "Return to page selection?",
    description:
      "Changes made to the current extracted Source Text will be discarded.",
    confirmLabel: "Return to page selection",
    cancelLabel: "Keep editing",
  },
};

// While the confirmed action is in flight, every way of dismissing the
// dialog is blocked (Escape/backdrop/Cancel) so a slow request can't race a
// second click or an accidental close (ANA-75).
export const Confirming: Story = {
  args: {
    isConfirming: true,
  },
};
