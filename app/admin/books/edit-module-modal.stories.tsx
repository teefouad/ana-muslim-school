import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Book } from "@/lib/books/types";
import { EditModuleModal } from "./edit-module-modal";
import { LESSON_FIXTURES } from "./lesson-fixtures";
import { createEmptyModuleFieldsValues } from "./module-fields";

const FILLED_FIELDS = {
  title: { ar: "المقدمة", en: "Introduction" },
  description: { ar: "وصف مختصر للوحدة", en: "A short module description" },
  color: "cyan.6",
  content: { ar: "# محتوى\nنص تجريبي", en: "# Content\nSample text" },
};

const BOOK: Book = {
  id: "book-1",
  title: { ar: "عنوان الكتاب", en: "Book Title" },
  description: { ar: "وصف الكتاب", en: "Book Description" },
  longDescription: { ar: "وصف طويل للكتاب", en: "Book Long Description" },
  color: "cyan.6",
  imageId: "img-1",
  modules: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "a@example.com",
  updatedBy: "a@example.com",
};

const meta = {
  title: "Books/EditModuleModal",
  component: EditModuleModal,
  tags: ["autodocs"],
  args: {
    book: BOOK,
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

// The Lessons column beside the form (ANA-111) -- only rendered in edit
// mode, since a Module being created has no real id yet to attach Lessons
// to.
export const Edit: Story = {
  args: {
    state: { mode: "edit", id: "module-1", fields: FILLED_FIELDS },
    lessons: LESSON_FIXTURES,
  },
};

// A freshly-Added Module's fields, shown standalone (every field starts
// blank/default) -- no Lessons yet either.
export const EditWithBlankFields: Story = {
  args: {
    state: {
      mode: "edit",
      id: "module-1",
      fields: createEmptyModuleFieldsValues(),
    },
    lessons: [],
  },
};

export const EditLessonsLoading: Story = {
  args: {
    state: { mode: "edit", id: "module-1", fields: FILLED_FIELDS },
    lessonsLoading: true,
  },
};

export const EditLessonsLoadError: Story = {
  args: {
    state: { mode: "edit", id: "module-1", fields: FILLED_FIELDS },
    lessonsLoadError: "Couldn't load this module's lessons.",
  },
};

export const Closed: Story = {
  args: {
    state: null,
  },
};
