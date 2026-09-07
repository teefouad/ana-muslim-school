import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  PdfViewerToolbar,
  type PdfViewerToolbarProps,
} from "./pdf-viewer-toolbar";

function PdfViewerToolbarDemo(props: PdfViewerToolbarProps) {
  const [currentPage, setCurrentPage] = useState(props.currentPage);
  const [zoomPercent, setZoomPercent] = useState(props.zoomPercent);

  return (
    <PdfViewerToolbar
      {...props}
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      zoomPercent={zoomPercent}
      onZoomChange={setZoomPercent}
    />
  );
}

const meta = {
  title: "Books/ImportSource/PdfViewerToolbar",
  component: PdfViewerToolbar,
  tags: ["autodocs"],
  args: {
    fileName: "the-sealed-nectar.pdf",
    currentPage: 3,
    numPages: 42,
    zoomPercent: 100,
    onPageChange: () => {},
    onZoomChange: () => {},
    onChooseDifferentFile: () => {},
  },
  render: (args) => (
    <div style={{ width: 720 }}>
      <PdfViewerToolbarDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof PdfViewerToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstPage: Story = {
  args: { currentPage: 1 },
};

export const LastPage: Story = {
  args: { currentPage: 42 },
};

export const LongFilename: Story = {
  args: {
    fileName:
      "the-sealed-nectar-biography-of-prophet-muhammad-peace-be-upon-him-complete-edition.pdf",
  },
};
