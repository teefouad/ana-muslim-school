import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModuleList, type ModuleListProps } from "./module-list";
import type { TempModule } from "./import-source-types";

const SAMPLE_MODULES: TempModule[] = [
  { id: "module-1", text: "The first selected passage of source text." },
  { id: "module-2", text: "A second passage, selected separately." },
  { id: "module-3", text: "A third module." },
];

function ModuleListDemo(props: ModuleListProps) {
  const [modules, setModules] = useState(props.modules);
  return <ModuleList modules={modules} onModulesChange={setModules} />;
}

const meta = {
  title: "Books/ImportSource/ModuleList",
  component: ModuleList,
  tags: ["autodocs"],
  args: {
    modules: SAMPLE_MODULES,
    onModulesChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 420 }}>
      <ModuleListDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof ModuleList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Single: Story = {
  args: { modules: [SAMPLE_MODULES[0]] },
};
