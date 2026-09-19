import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Lesson } from "@/lib/lessons/types";
import { buildLessonFixture } from "./lesson-fixtures";
import {
  LessonsDrawerList,
  type LessonsDrawerListProps,
} from "./lessons-drawer-list";

const SAMPLE_LESSONS: Lesson[] = [
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

// Wraps LessonsDrawerList with local state so reorder behaves for real in
// Storybook -- the component itself is fully controlled and has no state
// of its own beyond its own delete-confirmation UI (mirrors
// `LessonsPanelDemo`, see lessons-panel.stories.tsx).
function LessonsDrawerListDemo({
  lessons: initialLessons,
  onReorder,
  ...rest
}: LessonsDrawerListProps) {
  const [lessons, setLessons] = useState(initialLessons);

  return (
    <LessonsDrawerList
      {...rest}
      lessons={lessons}
      onReorder={(next) => {
        setLessons(next);
        onReorder(next);
      }}
    />
  );
}

const meta = {
  title: "Books/LessonsDrawerList",
  component: LessonsDrawerList,
  tags: ["autodocs"],
  args: {
    onReorder: () => {},
    onEditLesson: () => {},
    onDeleteLesson: () => Promise.resolve(),
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <LessonsDrawerListDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LessonsDrawerList>;

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

export const Loading: Story = {
  args: {
    lessons: [],
    loading: true,
  },
};
