import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { PdfPageCanvas } from "./pdf-page-canvas";
import { WithTestPdfDocument } from "./pdf-doc-story-helper";

const meta = {
  title: "Books/ImportSource/PdfPageCanvas",
  component: PdfPageCanvas,
  tags: ["autodocs"],
  // `doc` only ever comes from the WithTestPdfDocument wrapper each story's
  // own `render` uses below -- this placeholder exists purely to satisfy
  // the required prop's type.
  args: { doc: null as unknown as PdfDocument, pageNumber: 1 },
} satisfies Meta<typeof PdfPageCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <WithTestPdfDocument pageCount={3}>
      {(doc) => (
        <PdfPageCanvas
          doc={doc}
          pageNumber={1}
          targetWidth={320}
          lazy={false}
        />
      )}
    </WithTestPdfDocument>
  ),
};

export const Thumbnail: Story = {
  render: () => (
    <WithTestPdfDocument pageCount={3}>
      {(doc) => (
        <PdfPageCanvas
          doc={doc}
          pageNumber={2}
          targetWidth={144}
          lazy={false}
        />
      )}
    </WithTestPdfDocument>
  ),
};
