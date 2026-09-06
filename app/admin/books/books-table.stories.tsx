import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BOOK_FIXTURES } from "./book-fixtures";
import { BooksTable } from "./books-table";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const meta = {
  title: "Books/BooksTable",
  component: BooksTable,
  tags: ["autodocs"],
} satisfies Meta<typeof BooksTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// BooksTable fetches from `GET /api/v1/books` itself (ANA-65) -- these
// stories stub `fetch` with fixture data so Storybook never calls the real
// API.
export const Populated: Story = {
  render: () => {
    globalThis.fetch = (async () =>
      jsonResponse({ data: BOOK_FIXTURES })) as typeof fetch;

    return (
      <div style={{ width: 900 }}>
        <BooksTable />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => {
    globalThis.fetch = (async () => jsonResponse({ data: [] })) as typeof fetch;

    return (
      <div style={{ width: 900 }}>
        <BooksTable />
      </div>
    );
  },
};
