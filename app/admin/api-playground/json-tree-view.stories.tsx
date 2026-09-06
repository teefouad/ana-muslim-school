import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { JsonTreeView } from "./json-tree-view";

const meta = {
  title: "ApiPlayground/JsonTreeView",
  component: JsonTreeView,
  tags: ["autodocs"],
} satisfies Meta<typeof JsonTreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: {
    src: { data: { id: "doc-1", title: "Sealed Nectar", published: true } },
    name: false,
    theme: "monokai",
    displayDataTypes: false,
    collapsed: false,
  },
};

export const Collapsed: Story = {
  args: {
    ...Expanded.args,
    collapsed: true,
  },
};
