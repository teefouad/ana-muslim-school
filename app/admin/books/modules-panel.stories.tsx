import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { MockModule } from "./mock-modules";
import { ModulesPanel, type ModulesPanelProps } from "./modules-panel";

const SAMPLE_MODULES: MockModule[] = [
  { id: "module-1", title: "Introduction" },
  { id: "module-2", title: "Prayer basics" },
  { id: "module-3", title: "Summary" },
];

const MANY_MODULES: MockModule[] = Array.from({ length: 12 }, (_, index) => ({
  id: `module-${index + 1}`,
  // Every third module has a blank title to also demonstrate the
  // "Module N" fallback label alongside the overflow/scroll behavior.
  title: index % 3 === 0 ? "" : `Module title ${index + 1}`,
}));

// Wraps ModulesPanel with local state so reorder/Add module behave for
// real in Storybook, the same way the Add/Edit Book pages own that state
// (ANA-61) -- the component itself is fully controlled and has no state.
function ModulesPanelDemo({
  modules: initialModules,
  onModulesChange,
  ...rest
}: ModulesPanelProps) {
  const [modules, setModules] = useState(initialModules);

  return (
    <ModulesPanel
      {...rest}
      modules={modules}
      onModulesChange={(next) => {
        setModules(next);
        onModulesChange(next);
      }}
    />
  );
}

const meta = {
  title: "Books/ModulesPanel",
  component: ModulesPanel,
  tags: ["autodocs"],
  args: {
    onModulesChange: () => {},
  },
  render: (args) => (
    <div style={{ width: 320, height: 420 }}>
      <ModulesPanelDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof ModulesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    modules: SAMPLE_MODULES,
  },
};

export const Empty: Story = {
  args: {
    modules: [],
  },
};

// Add Book before its first save: visible, but reordering and Add module
// are suspended until the mock Book exists (ANA-61).
export const Disabled: Story = {
  args: {
    modules: SAMPLE_MODULES,
    disabled: true,
  },
};

export const ManyModulesOverflow: Story = {
  args: {
    modules: MANY_MODULES,
  },
};
