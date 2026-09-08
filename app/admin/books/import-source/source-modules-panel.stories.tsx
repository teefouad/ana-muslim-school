import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import { SourceModulesPanel } from "./source-modules-panel";

type Item = { key: string; material: TranslatableString };

const SAMPLE_ITEMS: Item[] = [
  { key: "module-1", material: { ar: "أول", en: "First" } },
  { key: "module-2", material: { ar: "ثاني", en: "" } },
];

function SourceModulesPanelDemo(
  props: React.ComponentProps<typeof SourceModulesPanel<Item>>,
) {
  const [items, setItems] = useState(props.items);

  return (
    <div style={{ height: "70vh", width: 420 }}>
      <SourceModulesPanel<Item>
        {...props}
        items={items}
        onReorder={setItems}
        onMaterialChange={(key, material) =>
          setItems((current) =>
            current.map((item) =>
              item.key === key ? { ...item, material } : item,
            ),
          )
        }
      />
    </div>
  );
}

const meta = {
  title: "Books/ImportSource/SourceModulesPanel",
  component: SourceModulesPanel<Item>,
  tags: ["autodocs"],
  args: {
    items: [],
    getKey: (item: Item) => item.key,
    getMaterial: (item: Item) => item.material,
    onMaterialChange: () => {},
    onReorder: () => {},
    fontScale: 100,
    disabled: false,
    reorderDisabled: false,
    canCreateModule: false,
    onCreateModule: () => {},
    onDeleteItem: () => {},
    isDeleteDisabled: () => false,
    onTranslateItem: async () => {},
  },
  render: (args) => <SourceModulesPanelDemo {...args} />,
} satisfies Meta<typeof SourceModulesPanel<Item>>;

export default meta;
type Story = StoryObj<typeof meta>;

// The shared panel used by both Create-from-PDF and View Source Text
// (ANA-79) -- same header/count, Create Module, empty state, sortable list,
// card spacing, and drag overlay regardless of which flow's data it's
// bound to.
export const Empty: Story = {};

export const WithModules: Story = {
  args: { items: SAMPLE_ITEMS, canCreateModule: true },
};

export const Disabled: Story = {
  args: { items: SAMPLE_ITEMS, disabled: true },
};

export const ReorderDisabled: Story = {
  args: { items: SAMPLE_ITEMS, reorderDisabled: true },
};
