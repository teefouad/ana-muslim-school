import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { buildQuestionFixture } from "./question-fixtures";
import { QuestionBankPicker } from "./question-bank-picker";

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
];

const meta = {
  title: "Books/QuestionBankPicker",
  component: QuestionBankPicker,
  tags: ["autodocs"],
  args: {
    opened: true,
    questions: MODULE_QUESTIONS,
    excludeQuestionIds: [],
    onSelect: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof QuestionBankPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithExclusions: Story = {
  args: {
    excludeQuestionIds: ["question-1"],
  },
};

export const Empty: Story = {
  args: {
    questions: [],
  },
};
