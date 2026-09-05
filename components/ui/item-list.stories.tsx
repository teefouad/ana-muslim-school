import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ItemList } from "./item-list";

const meta = {
  title: "UI/ItemList",
  component: ItemList,
  tags: ["autodocs"],
} satisfies Meta<typeof ItemList>;

export default meta;
type Story = StoryObj<typeof meta>;

interface DemoItem {
  id: string;
  label: string;
}

const INITIAL_ITEMS: DemoItem[] = [
  { id: "1", label: "First item" },
  { id: "2", label: "Second item" },
  { id: "3", label: "Third item" },
];

const MANY_ITEMS: DemoItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1),
  label: `Section ${index + 1}`,
}));

// `args` only exists to satisfy StoryObj's required-props type for a
// *generic* component -- `ItemList<T>`'s props collapse to `unknown` once
// run through `Meta<typeof ItemList>` (Storybook's Meta/StoryObj helpers
// don't preserve a component's own type parameter), so the values below are
// cast rather than genuinely type-checked. `render` ignores them entirely --
// each story owns its own state and renders the real, correctly-typed
// `<ItemList<DemoItem>>` itself, same convention as sortable-list.stories.tsx.
function Demo({
  sortable,
  editable,
  deletable,
  editDisabled,
  deleteDisabled,
  addDisabled,
  items: initialItems = INITIAL_ITEMS,
  boundedHeight,
}: {
  sortable: boolean;
  editable: boolean;
  deletable: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
  addDisabled?: boolean;
  items?: DemoItem[];
  boundedHeight?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextId, setNextId] = useState(initialItems.length + 1);

  const list = (
    <ItemList
      title="Sections"
      subtitle={`${items.length} item${items.length === 1 ? "" : "s"}`}
      items={items}
      getItemId={(item) => item.id}
      renderItem={(item) => item.label}
      emptyState="No sections yet."
      sortable={sortable}
      onReorder={setItems}
      onEditItem={editable ? () => {} : undefined}
      getEditLabel={(item) => `Edit ${item.label}`}
      editDisabled={editDisabled}
      onDeleteItem={
        deletable
          ? (item) => setItems((current) => current.filter((i) => i !== item))
          : undefined
      }
      getDeleteLabel={(item) => `Delete ${item.label}`}
      deleteDisabled={deleteDisabled}
      addLabel="Add section"
      addDisabled={addDisabled}
      onAdd={() => {
        setItems((current) => [
          ...current,
          { id: String(nextId), label: `New section ${nextId}` },
        ]);
        setNextId((n) => n + 1);
      }}
    />
  );

  return boundedHeight ? (
    <div style={{ height: 320, width: 320 }}>{list}</div>
  ) : (
    <div style={{ width: 320 }}>{list}</div>
  );
}

// Drag any row's grip (pointer, or Tab to focus + Space/arrow keys/Space) to
// reorder, or hover/focus a row to reveal its Edit and Delete actions.
export const Default: Story = {
  args: {
    title: "Sections",
    items: INITIAL_ITEMS,
    getItemId: (item: DemoItem) => item.id,
    renderItem: (item: DemoItem) => item.label,
    emptyState: "No sections yet.",
    sortable: true,
    addLabel: "Add section",
    onAdd: () => {},
  } as Story["args"],
  render: () => <Demo sortable editable deletable />,
};

// `sortable={false}` never initializes drag behavior: no grip icon, no
// drag-and-drop, and Tab/Space over a row's grip does nothing (there is no
// grip to focus).
export const NonSortable: Story = {
  args: Default.args,
  render: () => <Demo sortable={false} editable deletable />,
};

// No `onEditItem`/`onDeleteItem` -- rows have no row-level actions at all,
// matching a read-only viewer. The Add button stays available.
export const ReadOnly: Story = {
  args: Default.args,
  render: () => <Demo sortable={false} editable={false} deletable={false} />,
};

// Edit/Delete actions and the Add button all render but are disabled --
// e.g. while a previous request is still in flight.
export const DisabledActions: Story = {
  args: Default.args,
  render: () => (
    <Demo sortable editable deletable editDisabled deleteDisabled addDisabled />
  ),
};

export const Empty: Story = {
  args: Default.args,
  render: () => <Demo sortable editable deletable items={[]} />,
};

// A fixed-height container makes the list body scroll internally while the
// header and Add footer stay put.
export const Overflow: Story = {
  args: Default.args,
  render: () => (
    <Demo sortable editable deletable items={MANY_ITEMS} boundedHeight />
  ),
};
