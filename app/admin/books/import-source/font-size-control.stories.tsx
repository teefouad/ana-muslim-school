import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  FontSizeControl,
  type FontSizeControlProps,
} from "./font-size-control";

function FontSizeControlDemo(props: FontSizeControlProps) {
  const [value, setValue] = useState(props.value);
  return <FontSizeControl value={value} onChange={setValue} />;
}

const meta = {
  title: "Books/ImportSource/FontSizeControl",
  component: FontSizeControl,
  tags: ["autodocs"],
  render: (args) => <FontSizeControlDemo {...args} />,
} satisfies Meta<typeof FontSizeControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 100, onChange: () => {} },
};
