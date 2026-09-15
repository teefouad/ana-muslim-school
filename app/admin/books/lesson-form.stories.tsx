import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LessonForm, type LessonFormProps } from "./lesson-form";
import type { LessonFieldsValues } from "./lesson-fields";

const SAMPLE_VALUE: LessonFieldsValues = {
  title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
  description: { ar: "مقدمة قصيرة عن الصلاة", en: "A short intro to prayer" },
  type: "text",
  position: 2,
  isPublished: true,
};

// Wraps LessonForm with local state so every field edit behaves for real in
// Storybook -- the component itself is fully controlled and has no state of
// its own (mirrors LessonsPanelDemo, see lessons-panel.stories.tsx).
function LessonFormDemo({
  value: initialValue,
  onChange,
  ...rest
}: LessonFormProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <LessonForm
      {...rest}
      value={value}
      onChange={(patch) => {
        setValue((prev) => ({ ...prev, ...patch }));
        onChange(patch);
      }}
    />
  );
}

const meta = {
  title: "Books/LessonForm",
  component: LessonForm,
  tags: ["autodocs"],
  args: {
    onChange: () => {},
    moduleTitle: "الصلاة",
    moduleDescription: "مقدمة عن الصلاة",
    moduleContent: "محتوى تعليمي عن الصلاة",
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <LessonFormDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LessonForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  args: {
    value: SAMPLE_VALUE,
  },
};

export const Blank: Story = {
  args: {
    value: {
      title: {},
      description: {},
      type: "text",
      position: 2,
      isPublished: false,
    },
  },
};
