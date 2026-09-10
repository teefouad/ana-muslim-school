import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ColorSwatchPicker } from "./color-swatch-picker";

const meta = {
  title: "UI/ColorSwatchPicker",
  component: ColorSwatchPicker,
  tags: ["autodocs"],
  args: {
    value: "pink.6",
    onChange: () => {},
  },
} satisfies Meta<typeof ColorSwatchPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    value: "pink.6",
  },
};

// A value that isn't one of the 15 `<name>.6` tokens -- a different shade,
// or a free-form hex the admin typed into the paired Autocomplete -- leaves
// every swatch unselected (ANA-89).
export const NoneSelected: Story = {
  args: {
    value: "#1c7ed6",
  },
};

// Interactive: clicking a swatch moves the check mark, same as it would
// wired to the Book form's `color` field.
export const Interactive: Story = {
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState(args.value);
      return <ColorSwatchPicker value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
};

// Suspends selection (ANA-94) -- e.g. while an in-flight save/AI request in
// the Edit Module modal could still overwrite the field's value.
export const Disabled: Story = {
  args: {
    value: "pink.6",
    disabled: true,
  },
};
