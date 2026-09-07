import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PdfFilePicker } from "./pdf-file-picker";

const meta = {
  title: "Books/ImportSource/PdfFilePicker",
  component: PdfFilePicker,
  tags: ["autodocs"],
  args: {
    onFileSelected: () => {},
  },
  render: (args) => (
    <div style={{ display: "flex", width: 900, height: 500 }}>
      <PdfFilePicker {...args} />
    </div>
  ),
} satisfies Meta<typeof PdfFilePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
