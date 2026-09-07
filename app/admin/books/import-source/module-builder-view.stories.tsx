import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule } from "./import-source-types";
import {
  ModuleBuilderView,
  type ModuleBuilderViewProps,
} from "./module-builder-view";

const SAMPLE_RESULT: OcrResult = {
  model: "mistral-ocr-latest",
  pagesProcessed: 2,
  docSizeBytes: 1_200_000,
  pages: [
    {
      pageNumber: 1,
      markdown: "# مقدمة\n\nنص الصفحة الأولى الذي تم استخراجه.",
    },
    { pageNumber: 2, markdown: "## الفصل الأول\n\nنص الصفحة الثانية." },
  ],
};

const SAMPLE_MODULES: TempModule[] = [
  { id: "module-1", text: "نص الصفحة الأولى الذي تم استخراجه." },
];

function ModuleBuilderViewDemo(props: ModuleBuilderViewProps) {
  const [fontScale, setFontScale] = useState(props.fontScale);
  const [direction, setDirection] = useState(props.direction);
  const [modules, setModules] = useState(props.modules);

  return (
    <ModuleBuilderView
      {...props}
      fontScale={fontScale}
      onFontScaleChange={setFontScale}
      direction={direction}
      onDirectionChange={setDirection}
      modules={modules}
      onModulesChange={setModules}
    />
  );
}

const meta = {
  title: "Books/ImportSource/ModuleBuilderView",
  component: ModuleBuilderView,
  tags: ["autodocs"],
  args: {
    fileName: "the-sealed-nectar.pdf",
    ocrResult: SAMPLE_RESULT,
    editedMarkdown: Object.fromEntries(
      SAMPLE_RESULT.pages.map((page) => [page.pageNumber, page.markdown]),
    ),
    fontScale: 100,
    direction: "rtl" as const,
    onFontScaleChange: () => {},
    onDirectionChange: () => {},
    modules: [],
    onModulesChange: () => {},
    onBack: () => {},
    onCreateLearningMaterial: () => {},
  },
  render: (args) => (
    <div style={{ height: "80vh" }}>
      <ModuleBuilderViewDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof ModuleBuilderView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithModules: Story = {
  args: { modules: SAMPLE_MODULES },
};
