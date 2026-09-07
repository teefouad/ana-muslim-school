import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  SavedSourceView,
  type SavedSourceViewProps,
} from "./saved-source-view";

function SavedSourceViewDemo(props: SavedSourceViewProps) {
  const [fontScale, setFontScale] = useState(props.fontScale);
  const [direction, setDirection] = useState(props.direction);

  return (
    <SavedSourceView
      {...props}
      fontScale={fontScale}
      onFontScaleChange={setFontScale}
      direction={direction}
      onDirectionChange={setDirection}
    />
  );
}

const meta = {
  title: "Books/ImportSource/SavedSourceView",
  component: SavedSourceView,
  tags: ["autodocs"],
  args: {
    content:
      "# الفصل الأول\n\nنص الصفحة الأولى الذي تم استخراجه ومراجعته.\n\n# الفصل الثاني\n\nنص الصفحة الثانية.",
    onRemove: () => {},
    isRemoving: false,
    removeError: null,
    onSave: () => {},
    isSaving: false,
    saveError: null,
    fontScale: 100,
    direction: "rtl" as const,
    onFontScaleChange: () => {},
    onDirectionChange: () => {},
  },
  render: (args) => (
    <div style={{ height: "80vh", display: "flex" }}>
      <SavedSourceViewDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof SavedSourceView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Removing: Story = {
  args: { isRemoving: true },
};

export const RemoveFailed: Story = {
  args: { removeError: "Could not remove the source. Please try again." },
};

export const Saving: Story = {
  args: { isSaving: true },
};

export const SaveFailed: Story = {
  args: { saveError: "Could not save the source. Please try again." },
};
