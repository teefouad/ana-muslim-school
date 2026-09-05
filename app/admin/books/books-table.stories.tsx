import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BooksProvider } from "./books-store";
import { BooksTable } from "./books-table";
import { INITIAL_MOCK_BOOKS } from "./mock-books";

const meta = {
  title: "Books/BooksTable",
  component: BooksTable,
  tags: ["autodocs"],
} satisfies Meta<typeof BooksTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// BooksTable reads from the Books mock store (books-store.tsx) rather than
// taking records as a prop -- see app/admin/books/layout.tsx, which mounts
// the same provider around the real routes.
export const Populated: Story = {
  render: () => (
    <div style={{ width: 900 }}>
      <BooksProvider initialBooks={INITIAL_MOCK_BOOKS}>
        <BooksTable />
      </BooksProvider>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div style={{ width: 900 }}>
      <BooksProvider initialBooks={[]}>
        <BooksTable />
      </BooksProvider>
    </div>
  ),
};
