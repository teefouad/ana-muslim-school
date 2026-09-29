import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { withBasePromptStub } from "./base-prompt-story-decorator";
import { GenerateQuestionsModal } from "./generate-questions-modal";

const meta = {
  title: "UI/GenerateQuestionsModal",
  component: GenerateQuestionsModal,
  tags: ["autodocs"],
  decorators: [withBasePromptStub],
} satisfies Meta<typeof GenerateQuestionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    opened: true,
    onCancel: () => {},
    onGenerate: () => {},
  },
};

export const Generating: Story = {
  args: {
    opened: true,
    isGenerating: true,
    onCancel: () => {},
    onGenerate: () => {},
  },
};

export const WithError: Story = {
  args: {
    opened: true,
    error: "Question generation failed. Please try again.",
    onCancel: () => {},
    onGenerate: () => {},
  },
};
