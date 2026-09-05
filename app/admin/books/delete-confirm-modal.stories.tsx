import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DeleteConfirmModal } from "./delete-confirm-modal";
import type { MockBook } from "./mock-books";

const BOOK: MockBook = {
  id: "book-1",
  title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
  description: { ar: "", en: "" },
  imageId: "sealed-nectar",
  locked: false,
  published: true,
  color: "#1c7ed6",
};

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
