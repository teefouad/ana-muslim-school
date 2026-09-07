import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  SourceModuleCard,
  type SourceModuleCardProps,
} from "./source-module-card";

function SourceModuleCardDemo(props: SourceModuleCardProps) {
  const [material, setMaterial] = useState(props.material);

  return (
    <SourceModuleCard
      {...props}
      material={material}
      onMaterialChange={setMaterial}
    />
  );
}

const meta = {
  title: "Books/ImportSource/SourceModuleCard",
  component: SourceModuleCard,
  tags: ["autodocs"],
  args: {
    index: 0,
    material: "",
    onMaterialChange: () => {},
    direction: "rtl" as const,
    fontScale: 100,
  },
  render: (args) => (
    <div style={{ width: 720 }}>
      <SourceModuleCardDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof SourceModuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithLearningMaterial: Story = {
  args: {
    material: "## الدرس\n\nملخص الدرس هنا.",
  },
};

export const Ltr: Story = {
  args: {
    material: "This is the Learning Material for the Module.",
    direction: "ltr",
  },
};

export const Disabled: Story = {
  args: {
    material: "Frozen while Save Changes is in flight.",
    disabled: true,
  },
};
