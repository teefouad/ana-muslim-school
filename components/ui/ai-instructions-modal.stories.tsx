import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AiInstructionsModal } from "./ai-instructions-modal";

const meta = {
  title: "UI/AiInstructionsModal",
  component: AiInstructionsModal,
  tags: ["autodocs"],
} satisfies Meta<typeof AiInstructionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    opened: true,
    title: "AI Assistance",
    description: "The AI will rewrite this field's current text.",
    onCancel: () => {},
    onGenerate: () => {},
  },
};

export const CustomLabels: Story = {
  args: {
    opened: true,
    title: "Translate with AI",
    description:
      "The AI will translate the Arabic text into English, replacing the current English value.",
    generateLabel: "Translate",
    onCancel: () => {},
    onGenerate: () => {},
  },
};
