import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { OcrResult } from "@/lib/sources/ocr-types";
import { OcrResultView, type OcrResultViewProps } from "./ocr-result-view";
import { createTestPdfFile } from "./pdf-test-fixtures";

const SAMPLE_RESULT: OcrResult = {
  model: "mistral-ocr-latest",
  pagesProcessed: 3,
  docSizeBytes: 2_400_000,
  pages: [
    {
      pageNumber: 1,
      markdown: "# مقدمة\n\nهذا هو النص المستخرج من الصفحة الأولى.",
    },
    { pageNumber: 2, markdown: "## الفصل الأول\n\nنص الصفحة الثانية." },
    { pageNumber: 3, markdown: "" },
  ],
};

function OcrResultViewDemo(props: OcrResultViewProps) {
  const [editedMarkdown, setEditedMarkdown] = useState(props.editedMarkdown);
  const [fontScale, setFontScale] = useState(props.fontScale);
  const [direction, setDirection] = useState(props.direction);

  return (
    <OcrResultView
      {...props}
      editedMarkdown={editedMarkdown}
      onEditedMarkdownChange={setEditedMarkdown}
      fontScale={fontScale}
      onFontScaleChange={setFontScale}
      direction={direction}
      onDirectionChange={setDirection}
    />
  );
}

const meta = {
  title: "Books/ImportSource/OcrResultView",
  component: OcrResultView,
  tags: ["autodocs"],
  args: {
    file: createTestPdfFile(3, "the-sealed-nectar.pdf"),
    ocrResult: SAMPLE_RESULT,
    editedMarkdown: Object.fromEntries(
      SAMPLE_RESULT.pages.map((page) => [page.pageNumber, page.markdown]),
    ),
    fontScale: 100,
    direction: "rtl" as const,
    onEditedMarkdownChange: () => {},
    onFontScaleChange: () => {},
    onDirectionChange: () => {},
    onBack: () => {},
    onCreateModules: () => {},
  },
  render: (args) => (
    <div style={{ height: "80vh" }}>
      <OcrResultViewDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof OcrResultView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
