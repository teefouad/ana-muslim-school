import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { PdfThumbnailStrip } from "./pdf-thumbnail-strip";
import { WithTestPdfDocument } from "./pdf-doc-story-helper";

function PdfThumbnailStripDemo({
  doc,
  numPages,
}: {
  doc: PdfDocument;
  numPages: number;
}) {
  const [previewedPage, setPreviewedPage] = useState(1);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    new Set([1, 3]),
  );

  return (
    <div style={{ height: 480 }}>
      <PdfThumbnailStrip
        doc={doc}
        numPages={numPages}
        previewedPage={previewedPage}
        selectedPages={selectedPages}
        onPreviewPage={setPreviewedPage}
        onSelectedPagesChange={setSelectedPages}
      />
    </div>
  );
}

const meta = {
  title: "Books/ImportSource/PdfThumbnailStrip",
  component: PdfThumbnailStrip,
  tags: ["autodocs"],
  // These are never actually used -- the story's own `render` below (via
  // WithTestPdfDocument + PdfThumbnailStripDemo) supplies real values.
  // Placeholders exist purely to satisfy the required props' types.
  args: {
    doc: null as unknown as PdfDocument,
    numPages: 12,
    previewedPage: 1,
    selectedPages: new Set<number>(),
    onPreviewPage: () => {},
    onSelectedPagesChange: () => {},
  },
} satisfies Meta<typeof PdfThumbnailStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <WithTestPdfDocument pageCount={12}>
      {(doc) => <PdfThumbnailStripDemo doc={doc} numPages={12} />}
    </WithTestPdfDocument>
  ),
};
