import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Book } from "@/lib/books/types";
import { EditModuleDrawer } from "./edit-module-drawer";

const FILLED_FIELDS = {
  title: { ar: "المقدمة", en: "Introduction" },
  description: { ar: "وصف مختصر للوحدة", en: "A short module description" },
  color: "cyan.6",
  content: { ar: "# محتوى\nنص تجريبي", en: "# Content\nSample text" },
  isPublished: false,
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
  title: "Books/EditModuleDrawer",
  component: EditModuleDrawer,
  tags: ["autodocs"],
  args: {
    book: BOOK,
    onClose: () => {},
    onSave: async () => {},
  },
} satisfies Meta<typeof EditModuleDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

// Right-side drawer, 500px on desktop (ANA-121) -- renders the exact same
// Module-editing experience as the Edit Module modal's own Edit story
// (edit-module-modal.stories.tsx), just inside a narrower container: same
// fields, same Lessons list. Its Lessons are loaded live through the real
// Lesson list API, same as the modal -- this Storybook environment has no
// backend to serve that request, so this story shows the panel's own
// loading/error state rather than populated rows; see
// edit-module-drawer.test.tsx for coverage of a populated Lessons list.
export const Edit: Story = {
  args: {
    state: { id: "module-1", fields: FILLED_FIELDS },
  },
};

export const Closed: Story = {
  args: {
    state: null,
  },
};
