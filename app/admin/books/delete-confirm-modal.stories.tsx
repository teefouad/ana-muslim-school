import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { buildBookFixture } from "./book-fixtures";
import { DeleteConfirmModal } from "./delete-confirm-modal";

const BOOK = buildBookFixture();

const meta = {
  title: "Books/DeleteConfirmModal",
  component: DeleteConfirmModal,
  tags: ["autodocs"],
  args: {
    onClose: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof DeleteConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    book: BOOK,
  },
};

export const Closed: Story = {
  args: {
    book: null,
  },
};
