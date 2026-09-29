import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AiInstructionsModal } from "./ai-instructions-modal";
import { withBasePromptStub } from "./base-prompt-story-decorator";

const meta = {
  title: "UI/AiInstructionsModal",
  component: AiInstructionsModal,
  tags: ["autodocs"],
  decorators: [withBasePromptStub],
} satisfies Meta<typeof AiInstructionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    opened: true,
    promptTask: "assist.title",
    title: "AI Assistance",
    description: "The AI will rewrite this field's current text.",
    onCancel: () => {},
    onGenerate: () => {},
  },
};

export const CustomLabels: Story = {
  args: {
    opened: true,
    promptTask: "translate.plain",
    showInstructions: false,
    title: "Translate with AI",
    description:
      "The AI will translate the Arabic text into English, replacing the current English value.",
    generateLabel: "Translate",
    onCancel: () => {},
    onGenerate: () => {},
  },
};
