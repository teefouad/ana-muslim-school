import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { PdfThumbnail } from "./pdf-thumbnail";
import { WithTestPdfDocument } from "./pdf-doc-story-helper";

const meta = {
  title: "Books/ImportSource/PdfThumbnail",
  component: PdfThumbnail,
  tags: ["autodocs"],
  args: {
    // `doc` only ever comes from the WithTestPdfDocument wrapper each
    // story's `render` uses below -- this placeholder exists purely to
    // satisfy the required prop's type.
    doc: null as unknown as PdfDocument,
    pageNumber: 1,
    isPreviewed: false,
    isSelected: false,
    onPreview: () => {},
    onToggleSelect: () => {},
  },
} satisfies Meta<typeof PdfThumbnail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  render: (args) => (
    <WithTestPdfDocument>
      {(doc) => <PdfThumbnail {...args} doc={doc} />}
    </WithTestPdfDocument>
  ),
};

export const Selected: Story = {
  args: { isSelected: true },
  render: Unselected.render,
};

export const Previewed: Story = {
  args: { isPreviewed: true },
  render: Unselected.render,
};

export const SelectedAndPreviewed: Story = {
  args: { isSelected: true, isPreviewed: true },
  render: Unselected.render,
};
