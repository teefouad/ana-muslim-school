import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SavedSourceView } from "./saved-source-view";

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
  },
  render: (args) => (
    <div style={{ height: "80vh", display: "flex" }}>
      <SavedSourceView {...args} />
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
