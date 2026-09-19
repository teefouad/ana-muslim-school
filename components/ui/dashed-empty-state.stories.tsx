import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DashedEmptyState } from "./dashed-empty-state";

const meta = {
  title: "UI/DashedEmptyState",
  component: DashedEmptyState,
  tags: ["autodocs"],
  args: {
    children: "No questions yet.",
  },
} satisfies Meta<typeof DashedEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
