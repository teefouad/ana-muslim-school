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

const meta = {
  title: "Books/QuestionsEditor",
  component: QuestionsEditor,
  tags: ["autodocs"],
  args: {
    onChange: () => {},
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
      toQuestionFieldEntry(
        buildQuestionFixture({
          id: "question-1",
          text: {
            ar: "كم عدد أركان الصلاة؟",
            en: "How many pillars does Salah have?",
          },
        }),
      ),
      toQuestionFieldEntry(
        buildQuestionFixture({
          id: "question-2",
          text: { ar: "ما هو أول أركان الإسلام؟", en: "" },
        }),
      ),
    ],
  },
};
