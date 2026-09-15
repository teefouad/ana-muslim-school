import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LessonForm, type LessonFormProps } from "./lesson-form";
import type { MockLesson } from "./mock-lessons";

const SAMPLE_LESSON: MockLesson = {
  id: "lesson-1",
  title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
  description: { ar: "مقدمة قصيرة عن الصلاة", en: "A short intro to prayer" },
  type: "text",
  position: 2,
  isPublished: true,
};

// Wraps LessonForm with local state so every field edit behaves for real in
// Storybook -- the component itself is fully controlled and has no state of
// its own (mirrors LessonsPanelDemo, see lessons-panel.stories.tsx).
function LessonFormDemo({ lesson: initialLesson, onChange }: LessonFormProps) {
  const [lesson, setLesson] = useState(initialLesson);

  return (
    <LessonForm
      lesson={lesson}
      onChange={(id, patch) => {
        setLesson((prev) => (prev.id === id ? { ...prev, ...patch } : prev));
        onChange(id, patch);
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
    lesson: SAMPLE_LESSON,
  },
};

export const Blank: Story = {
  args: {
    lesson: {
      id: "lesson-new",
      title: {},
      description: {},
      type: "text",
      position: 2,
      isPublished: false,
    },
  },
};
