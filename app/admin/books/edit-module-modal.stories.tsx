import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Book } from "@/lib/books/types";
import type { Lesson } from "@/lib/lessons/types";
import { EditModuleModal } from "./edit-module-modal";
import { buildLessonFixture } from "./lesson-fixtures";
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
    onCreateLesson: async () => {},
    onUpdateLesson: async () => {},
    onDeleteLesson: async () => {},
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

// Module mode's two-column layout (ANA-111, polished in ANA-115): Module
// form and Lessons list, with real Edit/Delete actions on each row --
// reorderable, and New Lesson opens Lesson mode with a blank draft.
const SAMPLE_LESSONS: Lesson[] = [
  buildLessonFixture({
    id: "lesson-1",
    title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
    isPublished: true,
  }),
  buildLessonFixture({
    id: "lesson-2",
    title: { ar: "", en: "The five daily prayers" },
    type: "video",
    position: 1,
  }),
];

export const EditWithLessons: Story = {
  args: {
    state: {
      mode: "edit",
      id: "module-1",
      fields: FILLED_FIELDS,
      lessons: SAMPLE_LESSONS,
    },
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
