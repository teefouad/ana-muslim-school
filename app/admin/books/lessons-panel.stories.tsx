import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LessonsPanel, type LessonsPanelProps } from "./lessons-panel";
import type { MockLesson } from "./mock-lessons";

const SAMPLE_LESSONS: MockLesson[] = [
  {
    id: "lesson-1",
    title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
    description: { ar: "", en: "" },
    type: "text",
    position: 0,
    isPublished: true,
  },
  {
    id: "lesson-2",
    title: { ar: "", en: "The five daily prayers" },
    description: { ar: "", en: "" },
    type: "video",
    position: 1,
    isPublished: false,
  },
  {
    id: "lesson-3",
    title: { ar: "", en: "Summary" },
    description: { ar: "", en: "" },
    type: "final",
    position: 2,
    isPublished: false,
  },
];

// Wraps LessonsPanel with local state so reorder/Add lesson/selection
// (ANA-114) behave for real in Storybook -- the component itself is fully
// controlled and has no state of its own (mirrors ModulesPanelDemo, see
// modules-panel.stories.tsx).
function LessonsPanelDemo({
  lessons: initialLessons,
  onLessonsChange,
  selectedLessonId: initialSelectedLessonId,
  onSelectLesson,
  ...rest
}: LessonsPanelProps) {
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedLessonId, setSelectedLessonId] = useState(
    initialSelectedLessonId ?? null,
  );

  return (
    <LessonsPanel
      {...rest}
      lessons={lessons}
      onLessonsChange={(next) => {
        setLessons(next);
        onLessonsChange(next);
      }}
      selectedLessonId={selectedLessonId}
      onSelectLesson={(lesson) => {
        setSelectedLessonId(lesson.id);
        onSelectLesson?.(lesson);
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

// A row rendered as selected on load (ANA-114) -- clicking any other row
// still moves the selection, since the demo wrapper above owns it as local
// state, same as reorder/Add lesson.
export const Selected: Story = {
  args: {
    lessons: SAMPLE_LESSONS,
    selectedLessonId: "lesson-2",
  },
};
