import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EditModuleModal } from "./edit-module-modal";
import { createEmptyModuleFieldsValues } from "./module-fields";

const FILLED_MODULE = {
  id: "module-1",
  title: { ar: "المقدمة", en: "Introduction" },
  description: { ar: "وصف مختصر للوحدة", en: "A short module description" },
  color: "cyan.6",
  content: { ar: "# محتوى\nنص تجريبي", en: "# Content\nSample text" },
};

const meta = {
  title: "Books/EditModuleModal",
  component: EditModuleModal,
  tags: ["autodocs"],
  args: {
    bookId: "book-1",
    onClose: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof EditModuleModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  args: {
    module: FILLED_MODULE,
  },
};

// A freshly-Added Module (ANA-91): every field starts blank/default before
// the admin fills anything in.
export const NewModule: Story = {
  args: {
    module: { id: "module-new", ...createEmptyModuleFieldsValues() },
  },
};

export const Closed: Story = {
  args: {
    module: null,
  },
};
