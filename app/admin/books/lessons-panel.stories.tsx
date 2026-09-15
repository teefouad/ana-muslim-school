import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { buildLessonFixture } from "./lesson-fixtures";
import { LessonsPanel, type LessonsPanelProps } from "./lessons-panel";
import type { MockLesson } from "./mock-lessons";

const SAMPLE_LESSONS: MockLesson[] = [
  buildLessonFixture({
    id: "lesson-1",
    title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
    isPublished: true,
  }),
  buildLessonFixture({
    id: "lesson-2",
    title: { ar: "", en: "The five daily prayers" },
    type: "video",
    position: 1,
  }),
  buildLessonFixture({
    id: "lesson-3",
    title: { ar: "", en: "Summary" },
    type: "final",
    position: 2,
  }),
];

// Wraps LessonsPanel with local state so reorder behaves for real in
// Storybook -- the component itself is fully controlled and has no state of
// its own (mirrors ModulesPanelDemo, see modules-panel.stories.tsx).
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
    onEditLesson: () => {},
    onDeleteLesson: () => {},
    onNewLesson: () => {},
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
