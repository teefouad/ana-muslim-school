import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PdfViewer, type PdfViewerProps } from "./pdf-viewer";
import { createTestPdfFile } from "./pdf-test-fixtures";

function PdfViewerDemo(props: PdfViewerProps) {
  const [selectedPages, setSelectedPages] = useState(props.selectedPages);

  return (
    <PdfViewer
      {...props}
      selectedPages={selectedPages}
      onSelectedPagesChange={setSelectedPages}
    />
  );
}

const meta = {
  title: "Books/ImportSource/PdfViewer",
  component: PdfViewer,
  tags: ["autodocs"],
  args: {
    file: createTestPdfFile(10, "the-sealed-nectar.pdf"),
    selectedPages: new Set<number>(),
    onSelectedPagesChange: () => {},
    onChooseDifferentFile: () => {},
    onRunOcr: () => {},
    isRunningOcr: false,
    ocrError: null,
  },
  render: (args) => (
    <div style={{ height: "80vh" }}>
      <PdfViewerDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof PdfViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SomePagesSelected: Story = {
  args: { selectedPages: new Set([1, 3, 4]) },
};

export const RunningOcr: Story = {
  args: { selectedPages: new Set([1, 2]), isRunningOcr: true },
};

export const OcrFailed: Story = {
  args: {
    selectedPages: new Set([1, 2]),
    ocrError: "OCR processing failed. Please try again.",
  },
};
