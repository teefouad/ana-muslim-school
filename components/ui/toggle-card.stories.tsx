import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stack } from "@mantine/core";

import { ToggleCard } from "./toggle-card";

const meta = {
  title: "UI/ToggleCard",
  component: ToggleCard,
  tags: ["autodocs"],
  args: {
    label: "Published",
    checked: false,
    onChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <ToggleCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ToggleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UncheckedPrimary: Story = {
  args: {
    label: "Published",
    description: "Visible to readers in the app.",
    checked: false,
    variant: "primary",
  },
};

export const CheckedPrimary: Story = {
  args: {
    ...UncheckedPrimary.args,
    checked: true,
  },
};

export const UncheckedError: Story = {
  args: {
    label: "Locked",
    description: "Prevents further edits to this book.",
    checked: false,
    variant: "error",
  },
};

export const CheckedError: Story = {
  args: {
    ...UncheckedError.args,
    checked: true,
  },
};

export const LabelOnly: Story = {
  args: {
    label: "Published",
    checked: true,
    variant: "primary",
  },
};

export const Disabled: Story = {
  args: {
    ...UncheckedPrimary.args,
    checked: true,
    disabled: true,
  },
};

// A fully controlled example -- click the card or press Space/Enter while
// it's focused to toggle it.
export const Interactive: Story = {
  args: {
    label: "Published",
    description: "Visible to readers in the app.",
    variant: "primary",
  },
  render: (args) => {
    function InteractiveDemo() {
      const [checked, setChecked] = useState(false);
      return (
        <Stack style={{ width: 360 }}>
          <ToggleCard {...args} checked={checked} onChange={setChecked} />
          <ToggleCard
            label="Locked"
            description="Prevents further edits to this book."
            variant="error"
            checked={!checked}
            onChange={(value) => setChecked(!value)}
          />
        </Stack>
      );
    }

    return <InteractiveDemo />;
  },
};
