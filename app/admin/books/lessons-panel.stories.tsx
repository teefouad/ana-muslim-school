import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LESSON_FIXTURES } from "./lesson-fixtures";
import { LessonsPanel, type LessonsPanelProps } from "./lessons-panel";

const MANY_LESSONS = Array.from({ length: 12 }, (_, index) => ({
  ...LESSON_FIXTURES[0],
  id: `lesson-${index + 1}`,
  // Every third lesson has a blank title to also demonstrate the
  // "Lesson N" fallback label alongside the overflow/scroll behavior.
  title:
    index % 3 === 0
      ? { ar: "", en: "" }
      : { ar: "", en: `Lesson title ${index + 1}` },
}));

// Wraps LessonsPanel with local state so reorder/Add lesson behave for real
// in Storybook, the same way the owning Edit Module page owns that state
// (ANA-111) -- the component itself is fully controlled and has no state.
function LessonsPanelDemo({
  lessons: initialLessons,
  onReorderLessons,
  ...rest
}: LessonsPanelProps) {
  const [lessons, setLessons] = useState(initialLessons);

  return (
    <LessonsPanel
      {...rest}
      lessons={lessons}
      onReorderLessons={(next) => {
        setLessons(next);
        onReorderLessons(next);
      }}
    />
  );
}

const meta = {
  title: "Books/LessonsPanel",
  component: LessonsPanel,
  tags: ["autodocs"],
  args: {
    onReorderLessons: () => {},
    onAddLesson: () => {},
  },
  render: (args) => (
    <div style={{ width: 320, height: 420 }}>
      <LessonsPanelDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LessonsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    lessons: LESSON_FIXTURES,
  },
};

export const Empty: Story = {
  args: {
    lessons: [],
  },
};

export const ManyLessonsOverflow: Story = {
  args: {
    lessons: MANY_LESSONS,
  },
};

export const AddInFlight: Story = {
  args: {
    lessons: LESSON_FIXTURES,
    addDisabled: true,
  },
};

export const ReorderError: Story = {
  args: {
    lessons: LESSON_FIXTURES,
    error: "Something went wrong. Please try again.",
  },
};
