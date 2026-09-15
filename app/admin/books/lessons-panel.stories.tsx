import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LessonsPanel, type LessonsPanelProps } from "./lessons-panel";
import type { MockLesson } from "./mock-lessons";

const SAMPLE_LESSONS: MockLesson[] = [
  { id: "lesson-1", title: "What is Salah?", position: 0 },
  { id: "lesson-2", title: "The five daily prayers", position: 1 },
  { id: "lesson-3", title: "Summary", position: 2 },
];

// Wraps LessonsPanel with local state so reorder/Add lesson behave for real
// in Storybook -- the component itself is fully controlled and has no state
// of its own (mirrors ModulesPanelDemo, see modules-panel.stories.tsx).
function LessonsPanelDemo({
  lessons: initialLessons,
  onLessonsChange,
  ...rest
}: LessonsPanelProps) {
  const [lessons, setLessons] = useState(initialLessons);

  return (
    <LessonsPanel
      {...rest}
      lessons={lessons}
      onLessonsChange={(next) => {
        setLessons(next);
        onLessonsChange(next);
      }}
    />
  );
}

const meta = {
  title: "Books/LessonsPanel",
  component: LessonsPanel,
  tags: ["autodocs"],
  args: {
    onLessonsChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 280, height: 420 }}>
      <LessonsPanelDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LessonsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    lessons: SAMPLE_LESSONS,
  },
};

export const Empty: Story = {
  args: {
    lessons: [],
  },
};
