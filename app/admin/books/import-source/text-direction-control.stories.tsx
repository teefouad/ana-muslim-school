import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  TextDirectionControl,
  type TextDirectionControlProps,
} from "./text-direction-control";

function TextDirectionControlDemo(props: TextDirectionControlProps) {
  const [value, setValue] = useState(props.value);
  return <TextDirectionControl value={value} onChange={setValue} />;
}

const meta = {
  title: "Books/ImportSource/TextDirectionControl",
  component: TextDirectionControl,
  tags: ["autodocs"],
  render: (args) => <TextDirectionControlDemo {...args} />,
} satisfies Meta<typeof TextDirectionControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rtl: Story = {
  args: { value: "rtl", onChange: () => {} },
};

export const Ltr: Story = {
  args: { value: "ltr", onChange: () => {} },
};
