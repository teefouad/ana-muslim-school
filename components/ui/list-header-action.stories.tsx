import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Group } from "@mantine/core";
import { ListPlus, Plus, Sparkles } from "lucide-react";

import { ListHeaderAction } from "./list-header-action";

const meta = {
  title: "UI/ListHeaderAction",
  component: ListHeaderAction,
  tags: ["autodocs"],
  args: {
    icon: <Plus size={14} aria-hidden="true" />,
    children: "New",
    onClick: () => {},
  },
} satisfies Meta<typeof ListHeaderAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    icon: <Sparkles size={14} aria-hidden="true" />,
    children: "Generate",
    disabled: true,
  },
};

export const AllActions: Story = {
  render: () => (
    <Group gap="md">
      <ListHeaderAction icon={<Plus size={14} aria-hidden="true" />}>
        New
      </ListHeaderAction>
      <ListHeaderAction icon={<ListPlus size={14} aria-hidden="true" />}>
        Insert
      </ListHeaderAction>
      <ListHeaderAction
        icon={<Sparkles size={14} aria-hidden="true" />}
        disabled
      >
        Generate
      </ListHeaderAction>
    </Group>
  ),
};
