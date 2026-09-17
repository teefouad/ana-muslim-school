import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  QuestionTextEditor,
  type QuestionTextEditorProps,
} from "./question-text-editor";
import {
  makeQuestionFieldEntry,
  toQuestionFieldEntry,
} from "./question-fields";
import { buildQuestionFixture } from "./question-fixtures";

// Wraps QuestionTextEditor with local state so typing/language-switching/
// Translate all behave for real in Storybook -- the component itself is
// fully controlled and has no state of its own (mirrors LessonFormDemo, see
// lesson-form.stories.tsx).
function QuestionTextEditorDemo({
  question: initialQuestion,
  onChange,
  ...rest
}: QuestionTextEditorProps) {
  const [question, setQuestion] = useState(initialQuestion);

  return (
    <QuestionTextEditor
      {...rest}
      question={question}
      onChange={(next) => {
        setQuestion(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "Books/QuestionTextEditor",
  component: QuestionTextEditor,
  tags: ["autodocs"],
  args: {
    onChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 420 }}>
      <QuestionTextEditorDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof QuestionTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {
  args: {
    question: makeQuestionFieldEntry(),
  },
};

export const Filled: Story = {
  args: {
    question: toQuestionFieldEntry(buildQuestionFixture()),
  },
};
