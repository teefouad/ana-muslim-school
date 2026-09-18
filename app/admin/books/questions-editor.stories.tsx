import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { QuestionsEditor, type QuestionsEditorProps } from "./questions-editor";
import { toQuestionFieldEntry } from "./question-fields";
import { buildQuestionFixture } from "./question-fixtures";

// Wraps QuestionsEditor with local state so New/reorder/collapse/delete all
// behave for real in Storybook -- the component itself is fully controlled
// and has no state of its own (mirrors LessonBreakConfigDemo, see
// lesson-break-config.stories.tsx).
function QuestionsEditorDemo({
  questions: initialQuestions,
  onChange,
  ...rest
}: QuestionsEditorProps) {
  const [questions, setQuestions] = useState(initialQuestions);

  return (
    <QuestionsEditor
      {...rest}
      questions={questions}
      onChange={(next) => {
        setQuestions(next);
        onChange(next);
      }}
    />
  );
}

// The owning Module's own Question bank (ANA-120) -- includes both
// Questions already linked into `Filled` below (so Insert's exclusion is
// visible) and a couple more available to insert.
const MODULE_QUESTIONS = [
  buildQuestionFixture({
    id: "question-1",
    text: {
      ar: "كم عدد أركان الصلاة؟",
      en: "How many pillars does Salah have?",
    },
  }),
  buildQuestionFixture({
    id: "question-2",
    text: { ar: "ما هو أول أركان الإسلام؟", en: "" },
  }),
  buildQuestionFixture({
    id: "question-3",
    text: { ar: "ما هي أركان الإيمان؟", en: "What are the pillars of Iman?" },
  }),
  buildQuestionFixture({
    id: "question-4",
    text: { ar: "متى تجب الزكاة؟", en: "When is Zakah due?" },
  }),
];

// A previous Module's own Questions (ANA-120) -- also offered by Insert,
// copied into a new draft on selection rather than referenced directly.
const PREVIOUS_MODULE_QUESTIONS = [
  {
    moduleId: "module-0",
    questions: [
      buildQuestionFixture({
        id: "previous-question-1",
        text: { ar: "ما معنى الإخلاص؟", en: "What does sincerity mean?" },
      }),
    ],
  },
];

const meta = {
  title: "Books/QuestionsEditor",
  component: QuestionsEditor,
  tags: ["autodocs"],
  args: {
    onChange: () => {},
    moduleQuestions: MODULE_QUESTIONS,
    previousModuleQuestions: PREVIOUS_MODULE_QUESTIONS,
  },
  render: (args) => (
    <div style={{ width: 480 }}>
      <QuestionsEditorDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof QuestionsEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    questions: [],
  },
};

export const Filled: Story = {
  args: {
    questions: [
      toQuestionFieldEntry(MODULE_QUESTIONS[0]),
      toQuestionFieldEntry(MODULE_QUESTIONS[1]),
    ],
  },
};
