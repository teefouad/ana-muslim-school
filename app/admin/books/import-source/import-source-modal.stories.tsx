import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@mantine/core";

import { ImportSourceModal } from "./import-source-modal";

function ImportSourceModalDemo() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button onClick={() => setOpened(true)}>Import Source</Button>
      <ImportSourceModal
        opened={opened}
        onClose={() => setOpened(false)}
        bookId="book-1"
      />
    </>
  );
}

const meta = {
  title: "Books/ImportSource/ImportSourceModal",
  component: ImportSourceModal,
  tags: ["autodocs"],
  // Never actually used -- the demo above owns real opened/onClose state.
  args: { opened: false, onClose: () => {}, bookId: "book-1" },
  render: () => <ImportSourceModalDemo />,
} satisfies Meta<typeof ImportSourceModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
