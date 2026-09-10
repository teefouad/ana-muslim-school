import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EditModuleModal } from "./edit-module-modal";
import { createEmptyModuleFieldsValues } from "./module-fields";

const FILLED_FIELDS = {
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
    onCreate: async () => {},
    onSave: async () => {},
  },
} satisfies Meta<typeof EditModuleModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Add Module (ANA-94): opens empty, primary action "Save Module" -- nothing
// is added to the Module list until this modal's own create request
// succeeds.
export const Create: Story = {
  args: {
    state: { mode: "create" },
  },
};

export const Edit: Story = {
  args: {
    state: { mode: "edit", id: "module-1", fields: FILLED_FIELDS },
  },
};

// A freshly-Added Module's fields, shown standalone (every field starts
// blank/default).
export const EditWithBlankFields: Story = {
  args: {
    state: {
      mode: "edit",
      id: "module-1",
      fields: createEmptyModuleFieldsValues(),
    },
  },
};

export const Closed: Story = {
  args: {
    state: null,
  },
};
