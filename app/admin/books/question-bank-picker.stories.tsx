import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { buildQuestionFixture } from "./question-fixtures";
import {
  QuestionBankPicker,
  type QuestionBankCandidate,
} from "./question-bank-picker";

const CANDIDATES: QuestionBankCandidate[] = [
  {
    question: buildQuestionFixture({
      id: "question-1",
      text: {
        ar: "كم عدد أركان الصلاة؟",
        en: "How many pillars does Salah have?",
      },
    }),
    isCurrentModule: true,
  },
  {
    question: buildQuestionFixture({
      id: "question-2",
      text: { ar: "ما هو أول أركان الإسلام؟", en: "" },
    }),
    isCurrentModule: true,
  },
  // A previous Module's own Question (ANA-120) -- selecting it copies its
  // content into a new draft rather than reusing its id directly.
  {
    question: buildQuestionFixture({
      id: "previous-question-1",
      text: { ar: "ما معنى الإخلاص؟", en: "What does sincerity mean?" },
    }),
    isCurrentModule: false,
    moduleId: "module-0",
  },
];

const meta = {
  title: "Books/QuestionBankPicker",
  component: QuestionBankPicker,
  tags: ["autodocs"],
  args: {
    opened: true,
    candidates: CANDIDATES,
    onSelect: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof QuestionBankPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    candidates: [],
  },
};
