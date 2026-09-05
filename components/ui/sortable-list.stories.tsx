import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, Group, Paper } from "@mantine/core";
import { GripVertical } from "lucide-react";

import { SortableList } from "./sortable-list";

const meta = {
  title: "UI/SortableList",
  component: SortableList,
  tags: ["autodocs"],
} satisfies Meta<typeof SortableList>;

export default meta;
type Story = StoryObj<typeof meta>;

interface DemoItem {
  id: string;
  label: string;
}

const INITIAL_ITEMS: DemoItem[] = [
  { id: "1", label: "First row" },
  { id: "2", label: "Second row" },
  { id: "3", label: "Third row" },
  { id: "4", label: "Fourth row" },
];

// A minimal row implementation -- a real caller (e.g. ItemList) has its own
// row component with its own icons/actions/nested content, but each one
// calls useSortable({ id }) for its own drag handle/transform wiring
// exactly like this.
function DemoRow({ item }: { item: DemoItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <Paper
      component="li"
      ref={setNodeRef}
      withBorder
      radius="sm"
      p="xs"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Group gap="xs" wrap="nowrap">
        <Box
          component="span"
          {...attributes}
          {...listeners}
          style={{
            display: "inline-flex",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <GripVertical size={16} aria-hidden="true" />
        </Box>
        <span>{item.label}</span>
      </Group>
    </Paper>
  );
}

function DemoOverlay({ item }: { item: DemoItem }) {
  return (
    <Paper withBorder radius="sm" p="xs" shadow="md">
      <Group gap="xs" wrap="nowrap">
        <GripVertical size={16} aria-hidden="true" />
        <span>{item.label}</span>
      </Group>
    </Paper>
  );
}

function Demo() {
  const [items, setItems] = useState(INITIAL_ITEMS);

  return (
    <Paper withBorder p="xs" style={{ width: 320 }}>
      <SortableList
        items={items}
        getId={(item) => item.id}
        onReorder={setItems}
        renderItem={(item) => <DemoRow key={item.id} item={item} />}
        renderOverlay={(item) => <DemoOverlay item={item} />}
      />
    </Paper>
  );
}

// Drag any row (pointer, or Tab to focus + Space/arrow keys/Space) to
// reorder -- the same PointerSensor/KeyboardSensor wiring every sortable
// list in the app shares.
//
// `args` here only exists to satisfy StoryObj's required-props type for a
// *generic* component -- `SortableList<T>`'s props collapse to `unknown`
// once run through `Meta<typeof SortableList>` (Storybook's Meta/StoryObj
// helpers don't preserve a component's own type parameter), so the values
// below are cast rather than genuinely type-checked against `DemoItem`.
// `render` below ignores them entirely -- `Demo` owns its own state and
// renders the real, correctly-typed `<SortableList<DemoItem>>` itself.
export const Default: Story = {
  args: {
    items: INITIAL_ITEMS,
    getId: (item: DemoItem) => item.id,
    onReorder: () => {},
    renderItem: (item: DemoItem) => <DemoRow key={item.id} item={item} />,
    renderOverlay: (item: DemoItem) => <DemoOverlay item={item} />,
  } as Story["args"],
  render: () => <Demo />,
};
