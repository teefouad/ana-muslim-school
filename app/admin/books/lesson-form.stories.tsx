import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LessonForm, type LessonFormProps } from "./lesson-form";
import type { LessonFieldsValues } from "./lesson-fields";
import { toQuestionFieldEntry } from "./question-fields";
import { buildQuestionFixture } from "./question-fixtures";

const SAMPLE_VALUE: LessonFieldsValues = {
  title: { ar: "ما هي الصلاة؟", en: "What is Salah?" },
  description: { ar: "مقدمة قصيرة عن الصلاة", en: "A short intro to prayer" },
  type: "text",
  position: 2,
  isPublished: true,
  content: {
    ar: "# ما هي الصلاة؟\n\nالصلاة هي الركن الثاني من أركان الإسلام.",
    en: "# What is Salah?\n\nSalah is the second pillar of Islam.",
  },
  videoURL: "",
  duration: 0,
  azkar: [],
  questions: [],
};

const VIDEO_VALUE: LessonFieldsValues = {
  ...SAMPLE_VALUE,
  type: "video",
  content: {},
  videoURL: "https://example.com/salah-intro.mp4",
  duration: 180,
};

const BREAK_VALUE: LessonFieldsValues = {
  ...SAMPLE_VALUE,
  type: "break",
  content: {},
  azkar: [
    {
      id: "entry-1",
      text: { ar: "سبحان الله", en: "Subhan Allah" },
      repeat: 33,
    },
    {
      id: "entry-2",
      text: { ar: "الحمد لله", en: "Alhamdulillah" },
      repeat: 33,
    },
  ],
};

// The owning Module's own Question bank (ANA-120) -- includes the Question
// already linked into `QUIZ_VALUE` below plus one more, available for the
// Insert action to demonstrate.
const MODULE_QUESTIONS = [
  buildQuestionFixture(),
  buildQuestionFixture({
    id: "question-2",
    text: {
      ar: "ما هو أول أركان الإسلام؟",
      en: "What is the first pillar of Islam?",
    },
  }),
];

const QUIZ_VALUE: LessonFieldsValues = {
  ...SAMPLE_VALUE,
  type: "quiz",
  content: {},
  questions: [toQuestionFieldEntry(MODULE_QUESTIONS[0])],
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
    moduleQuestions: MODULE_QUESTIONS,
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
      content: {},
      videoURL: "",
      duration: 0,
      azkar: [],
      questions: [],
    },
  },
};

export const VideoType: Story = {
  args: {
    value: VIDEO_VALUE,
  },
};

export const BreakType: Story = {
  args: {
    value: BREAK_VALUE,
  },
};

export const QuizType: Story = {
  args: {
    value: QUIZ_VALUE,
  },
};
