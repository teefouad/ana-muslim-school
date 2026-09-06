import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";

import { ModuleCard, type ModuleCardProps } from "./module-card";

// ModuleCard calls useSortable, which requires an ancestor DndContext/
// SortableContext even outside a real drag -- this decorator supplies both
// without wiring up sensors/reordering (out of scope for this component's
// own story; see module-list.stories.tsx for the full sortable behavior).
function ModuleCardDemo(props: ModuleCardProps) {
  const [text, setText] = useState(props.module.text);

  return (
    <DndContext>
      <SortableContext items={[props.module.id]}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, width: 400 }}>
          <ModuleCard
            {...props}
            module={{ ...props.module, text }}
            onTextChange={setText}
          />
        </ul>
      </SortableContext>
    </DndContext>
  );
}

const meta = {
  title: "Books/ImportSource/ModuleCard",
  component: ModuleCard,
  tags: ["autodocs"],
  args: {
    module: { id: "module-1", text: "Selected source text goes here." },
    index: 0,
    onTextChange: () => {},
  },
  render: (args) => <ModuleCardDemo {...args} />,
} satisfies Meta<typeof ModuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
