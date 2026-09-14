import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Group } from "@mantine/core";
import { Languages, Pencil, Sparkles, Trash2 } from "lucide-react";

import { ActionIconButton } from "./action-icon-button";

const meta = {
  title: "UI/ActionIconButton",
  component: ActionIconButton,
  tags: ["autodocs"],
  args: {
    "aria-label": "AI Assistance",
    onClick: () => {},
    children: <Sparkles size={16} aria-hidden="true" />,
  },
} satisfies Meta<typeof ActionIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

// A deliberate color exception for a destructive action -- delete stays red
// everywhere it appears (Module Builder, the Modules panel, the Books/Users
// listing), while every other action button uses the default (primary)
// color.
export const Destructive: Story = {
  args: {
    "aria-label": "Delete",
    color: "red",
    children: <Trash2 size={16} aria-hidden="true" />,
  },
};

// The full set of action buttons this component standardizes across the
// admin (ANA-105), side by side.
export const AllActions: Story = {
  render: () => (
    <Group gap="xs">
      <ActionIconButton aria-label="AI Assistance" onClick={() => {}}>
        <Sparkles size={16} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton aria-label="Translate" onClick={() => {}}>
        <Languages size={16} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton aria-label="Edit" onClick={() => {}}>
        <Pencil size={16} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton aria-label="Delete" color="red" onClick={() => {}}>
        <Trash2 size={16} aria-hidden="true" />
      </ActionIconButton>
    </Group>
  ),
};
