import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { TempModule } from "./import-source-types";
import {
  LearningMaterialCard,
  type LearningMaterialCardProps,
} from "./learning-material-card";

const SAMPLE_MODULE: TempModule = {
  id: "module-1",
  text: "نص الصفحة الأولى الذي تم استخراجه.",
};

function LearningMaterialCardDemo(props: LearningMaterialCardProps) {
  const [learningMaterial, setLearningMaterial] = useState(
    props.learningMaterial,
  );

  return (
    <LearningMaterialCard
      {...props}
      learningMaterial={learningMaterial}
      onLearningMaterialChange={setLearningMaterial}
    />
  );
}

const meta = {
  title: "Books/ImportSource/LearningMaterialCard",
  component: LearningMaterialCard,
  tags: ["autodocs"],
  args: {
    module: SAMPLE_MODULE,
    index: 0,
    learningMaterial: "",
    onLearningMaterialChange: () => {},
    direction: "rtl" as const,
    fontScale: 100,
  },
  render: (args) => (
    <div style={{ width: 720 }}>
      <LearningMaterialCardDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LearningMaterialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithLearningMaterial: Story = {
  args: {
    learningMaterial: "## الدرس\n\nملخص الدرس هنا.",
  },
};

export const Ltr: Story = {
  args: {
    module: { id: "module-2", text: "This is the extracted source text." },
    direction: "ltr",
  },
};

// Demonstrates the equal-height fix (ANA-70): a much longer Source text
// than Learning material still leaves both columns the same height, and the
// Markdown editor's contenteditable area fills the extra space below its
// short content instead of leaving unclickable empty whitespace.
export const LongSourceText: Story = {
  args: {
    module: {
      id: "module-3",
      text: [
        "This is a long block of extracted source text meant to push the",
        "Source text column well past the Learning material column's own",
        "natural height, to demonstrate that both columns still stretch to",
        "match -- and that the Markdown editor grows to fill its column",
        "instead of stopping at its minimum content height.",
      ].join("\n"),
    },
    direction: "ltr",
    learningMaterial: "Short note.",
  },
};
