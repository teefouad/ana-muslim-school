import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { OcrPageCard, type OcrPageCardProps } from "./ocr-page-card";
import { WithTestPdfDocument } from "./pdf-doc-story-helper";

function OcrPageCardDemo(
  props: Omit<OcrPageCardProps, "doc"> & { doc: PdfDocument },
) {
  const [markdown, setMarkdown] = useState(props.markdown);

  return (
    <OcrPageCard
      {...props}
      markdown={markdown}
      onMarkdownChange={setMarkdown}
    />
  );
}

const meta = {
  title: "Books/ImportSource/OcrPageCard",
  component: OcrPageCard,
  tags: ["autodocs"],
  args: {
    // Never actually used -- the `render` below always supplies a real
    // doc via WithTestPdfDocument. Placeholder purely to satisfy the
    // required prop's type.
    doc: null as unknown as PdfDocument,
    pageNumber: 1,
    markdown: "# Chapter One\n\nThis is the extracted text of the page.",
    fontScale: 100,
    direction: "rtl" as const,
    onMarkdownChange: () => {},
  },
  render: (args) => (
    <WithTestPdfDocument>
      {(doc) => <OcrPageCardDemo {...args} doc={doc} />}
    </WithTestPdfDocument>
  ),
} satisfies Meta<typeof OcrPageCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { markdown: "" },
};

export const LeftToRight: Story = {
  args: { direction: "ltr" },
};

export const LargerFont: Story = {
  args: { fontScale: 150 },
};
