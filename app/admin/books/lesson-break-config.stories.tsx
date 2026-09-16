import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  LessonBreakConfig,
  type LessonBreakConfigProps,
} from "./lesson-break-config";

// Wraps LessonBreakConfig with local state so Add/Edit/Reorder/Delete all
// behave for real in Storybook -- the component itself is fully controlled
// and has no state of its own (mirrors LessonFormDemo, see
// lesson-form.stories.tsx).
function LessonBreakConfigDemo({
  value: initialValue,
  onChange,
}: LessonBreakConfigProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <LessonBreakConfig
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "Books/LessonBreakConfig",
  component: LessonBreakConfig,
  tags: ["autodocs"],
  args: {
    onChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 420 }}>
      <LessonBreakConfigDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof LessonBreakConfig>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  args: {
    value: [
      {
        id: "entry-1",
        text: { ar: "سبحان الله", en: "Subhan Allah" },
        repeat: 33,
      },
      {
        id: "entry-2",
        text: { ar: "الحمد لله", en: "Alhamdulillah" },
        repeat: 33,
      },
      {
        id: "entry-3",
        text: { ar: "الله أكبر", en: "Allahu Akbar" },
        repeat: 34,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    value: [],
  },
};
