import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Group } from "@mantine/core";

import { SaveButton } from "./save-button";

const meta = {
  title: "UI/SaveButton",
  component: SaveButton,
  tags: ["autodocs"],
  args: {
    dirty: false,
    children: "Save changes",
    onClick: () => {},
  },
} satisfies Meta<typeof SaveButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Nothing unsaved yet -- the theme's usual primary green.
export const Clean: Story = {
  args: {
    dirty: false,
  },
};

// Unsaved changes waiting -- the dirty color.
export const Dirty: Story = {
  args: {
    dirty: true,
  },
};

export const SideBySide: Story = {
  render: () => (
    <Group gap="sm">
      <SaveButton dirty={false} onClick={() => {}}>
        Save changes
      </SaveButton>
      <SaveButton dirty onClick={() => {}}>
        Save changes
      </SaveButton>
    </Group>
  ),
};
